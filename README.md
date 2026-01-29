# MDN RAG Chatbot

A RAG-powered chatbot application that answers developer questions using MDN Web Docs as the authoritative knowledge source. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

- Documentation-first AI chat experience
- Strong emphasis on citations and transparency
- Property-based testing for correctness guarantees
- Responsive design for desktop, tablet, and mobile
- Dark and light theme support

## Getting Started

### Prerequisites

- Node.js 20+ and npm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Testing

Run tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run tests with coverage:

```bash
npm run test:coverage
```

### Code Quality

Format code with Prettier:

```bash
npm run format
```

Check code formatting:

```bash
npm run format:check
```

Lint code:

```bash
npm run lint
```

## Project Structure

```
.
├── app/              # Next.js app directory (pages, layouts, API routes)
├── components/       # React components
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
├── lib/              # Library code and API clients
└── public/           # Static assets
```

## Technology Stack

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Testing**: Jest, React Testing Library, fast-check
- **Code Quality**: ESLint, Prettier

## Type Definitions

Core types are defined in the `types/` directory:

- `Message`: Chat messages from user or assistant
- `Citation`: References to MDN documents
- `ChatSession`: Chat session with message history
- `Theme`: Theme configuration (colors, typography)

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [fast-check Documentation](https://fast-check.dev/)

## License

This project is for educational purposes.
