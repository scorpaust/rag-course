#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';


async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(__dirname, '../');
  const docsDir = path.resolve(projectRoot, 'mdn-docs');
  const outputPath = path.resolve(projectRoot, 'chunks.json');

  console.log(`[chunk-docs] Project root: ${projectRoot}`);
  console.log(`[chunk-docs] Docs directory: ${docsDir}`);

  // Verify docs directory exists
  try {
    const stat = await fs.stat(docsDir);
    if (!stat.isDirectory()) {
      console.error(`[chunk-docs] ERROR: ${docsDir} is not a directory.`);
      process.exit(1);
    }
  } catch (err) {
    console.error(
      `[chunk-docs] ERROR: Docs directory not found at ${docsDir}. Ensure @mdn-docs/ exists at the project root.`,
    );
    process.exit(1);
  }

  const splitter = await RecursiveCharacterTextSplitter.fromLanguage('markdown', {
    chunkSize: 1500,
    chunkOverlap: 200,
  });

  const files = await collectMarkdownFiles(docsDir);
  console.log(`[chunk-docs] Found ${files.length} markdown files.`);

  const allChunks = [];

  for (const filePath of files) {
    const relativePath = path.relative(docsDir, filePath).replace(/\\/g, '/');
    console.log(`[chunk-docs] Processing: ${relativePath}`);

    const raw = await fs.readFile(filePath, 'utf8');

    // Parse YAML frontmatter
    const parsed = matter(raw);
    const frontmatter = parsed.data ?? {};
    const body = parsed.content;

    if (!body.trim()) {
      continue;
    }

    // Compute how many lines are before the body (frontmatter + delimiters)
    const bodyIndex = raw.indexOf(body);
    const preBody = bodyIndex > 0 ? raw.slice(0, bodyIndex) : '';
    const preBodyLines = preBody ? preBody.split(/\r?\n/).length : 0;
    const bodyLineOffset = preBodyLines; // first body line number = offset + 1 (1-based)

    // Prepare line and heading metadata for the body
    const bodyLines = body.split(/\r?\n/);
    const bodyLineStartIndices = [];
    const headingForLine = [];

    let offset = 0;
    let currentHeading = null;

    for (let i = 0; i < bodyLines.length; i++) {
      bodyLineStartIndices.push(offset);
      const line = bodyLines[i];
      const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line.trim());
      if (headingMatch) {
        currentHeading = headingMatch[2].trim();
      }
      headingForLine.push(currentHeading);
      offset += line.length + 1; // +1 for the newline that was removed by split
    }

    // Create LangChain documents for this file
    const docs = await splitter.createDocuments([body], [
      {
        source: relativePath,
        frontmatter,
      },
    ]);

    let searchStart = 0;
    let chunkIndex = 0;

    for (const doc of docs) {
      const text = doc.pageContent;
      if (!text.trim()) continue;

      const idx = body.indexOf(text, searchStart);
      if (idx === -1) {
        // Fallback: try from beginning once (rare, but to avoid hard failure)
        const retryIdx = body.indexOf(text);
        if (retryIdx === -1) {
          console.warn(
            `[chunk-docs] WARNING: Could not locate chunk text within body for ${relativePath}. Skipping chunk.`,
          );
          continue;
        }
        searchStart = retryIdx + text.length;
      } else {
        searchStart = idx + text.length;
      }

      const startChar = searchStart - text.length;
      const endChar = searchStart - 1;

      const startBodyLine = findLineNumber(startChar, bodyLineStartIndices);
      const endBodyLine = findLineNumber(endChar, bodyLineStartIndices);

      const startLine = bodyLineOffset + startBodyLine;
      const endLine = bodyLineOffset + endBodyLine;

      const headingText = headingForLine[startBodyLine - 1] || null;

      const chunk = {
        id: `${relativePath}::${chunkIndex}`,
        source: relativePath,
        startLine,
        endLine,
        heading: headingText,
        frontmatter,
        text,
      };

      allChunks.push(chunk);
      chunkIndex += 1;
    }
  }

  console.log(`[chunk-docs] Writing ${allChunks.length} chunks to ${outputPath}`);
  await fs.writeFile(outputPath, JSON.stringify(allChunks, null, 2), 'utf8');
  console.log('[chunk-docs] Done.');
}

async function collectMarkdownFiles(rootDir) {
  const results = [];

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
          results.push(fullPath);
        }
      }
    }
  }

  await walk(rootDir);
  return results;
}

function findLineNumber(charIndex, lineStartIndices) {
  // lineStartIndices is an array of starting char indexes for each line (0-based)
  // Returns 1-based line number.
  if (lineStartIndices.length === 0) return 1;

  let line = 0;
  for (let i = 0; i < lineStartIndices.length; i++) {
    if (lineStartIndices[i] <= charIndex) {
      line = i;
    } else {
      break;
    }
  }

  return line + 1;
}

main().catch((err) => {
  console.error('[chunk-docs] Unhandled error:', err);
  process.exit(1);
});
