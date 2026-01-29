import React from 'react';

// Simple mock for react-markdown that renders children as plain text
const ReactMarkdown = ({ children }: { children: string }) => {
  return <div>{children}</div>;
};

export default ReactMarkdown;
