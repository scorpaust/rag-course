export type CandidateChunk = {
  id: string;
  content: string;
  heading: string | null;
  chunkIndex: number;
  title: string;
  slug: string;
  source: string;
  distance: number; // pgvector <-> distance
};

type Token = string;

type Bm25Params = {
  k1?: number;
  b?: number;
};

type Bm25Stats = {
  avgDocLen: number;
  docFreq: Map<Token, number>;
  numDocs: number;
};

function tokenize(text: string): Token[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function computeBm25Stats(docs: string[]): Bm25Stats {
  const docFreq = new Map<Token, number>();
  let totalLen = 0;

  for (const doc of docs) {
    const tokens = tokenize(doc);
    totalLen += tokens.length;
    const seen = new Set<Token>();

    for (const tok of tokens) {
      if (seen.has(tok)) continue;
      seen.add(tok);
      docFreq.set(tok, (docFreq.get(tok) ?? 0) + 1);
    }
  }

  const numDocs = docs.length || 1;
  const avgDocLen = totalLen / numDocs || 1;

  return { avgDocLen, docFreq, numDocs };
}

function bm25Scores(query: string, docs: string[], params: Bm25Params = {}): number[] {
  const { k1 = 1.5, b = 0.75 } = params;

  const qTokens = tokenize(query);
  const qTermCounts = new Map<Token, number>();
  for (const t of qTokens) {
    qTermCounts.set(t, (qTermCounts.get(t) ?? 0) + 1);
  }

  const { avgDocLen, docFreq, numDocs } = computeBm25Stats(docs);
  const docTokens = docs.map((d) => tokenize(d));
  const docLens = docTokens.map((toks) => toks.length || 1);

  const scores = new Array(docs.length).fill(0);

  for (const [term] of qTermCounts) {
    const df = docFreq.get(term) ?? 0;
    if (df === 0) continue;

    const idf = Math.log(1 + (numDocs - df + 0.5) / (df + 0.5));

    for (let i = 0; i < docs.length; i++) {
      const toks = docTokens[i];
      const len = docLens[i];

      let tf = 0;
      for (const tok of toks) {
        if (tok === term) tf++;
      }
      if (tf === 0) continue;

      const denom = tf + k1 * (1 - b + (b * len) / avgDocLen);
      const termScore = idf * ((tf * (k1 + 1)) / denom);
      scores[i] += termScore;
    }
  }

  return scores;
}

function normalize(values: number[]): number[] {
  if (values.length === 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!isFinite(min) || !isFinite(max) || max === min) {
    return values.map(() => 0.5);
  }
  const range = max - min;
  return values.map((v) => (v - min) / range);
}

export function hybridRank(
  query: string,
  chunks: CandidateChunk[],
  alpha = 0.5, // weight for BM25
): (CandidateChunk & {
  hybridScore: number;
  bm25Score: number;
  bm25Norm: number;
  vecSim: number;
})[] {
  if (!chunks.length) return [];

  const docs = chunks.map((c) => {
    const parts = [c.title, c.heading ?? '', c.content];
    return parts.join(' ').trim();
  });

  const bm25 = bm25Scores(query, docs);
  const bm25Norm = normalize(bm25);

  const distances = chunks.map((c) => c.distance);
  const distNorm = normalize(distances);
  const vecSim = distNorm.map((d) => 1 - d);

  const finalScores = bm25Norm.map((b, i) => alpha * b + (1 - alpha) * vecSim[i]);

  const withScores = chunks.map((c, i) => ({
    ...c,
    hybridScore: finalScores[i],
    bm25Score: bm25[i],
    bm25Norm: bm25Norm[i],
    vecSim: vecSim[i],
  }));

  withScores.sort((a, b) => b.hybridScore - a.hybridScore);
  return withScores;
}
