# Getting Started

Learn how to set up ContextOS in your project in under 5 minutes.

## Prerequisites

- Node.js 18 or higher
- pnpm, npm, or yarn

## Installation

::: code-group

```bash [npm]
npm install -g @contextos/cli
```

```bash [pnpm]
pnpm add -g @contextos/cli
```

```bash [yarn]
yarn global add @contextos/cli
```

:::

## Initialize Your Project

Navigate to your project directory and run:

```bash
cd your-project
ctx init
```

This creates the `.contextos/` folder:

```
.contextos/
├── context.yaml      # Project definition
├── config.yaml       # Tool settings
├── db/               # Vector store & graph
└── rules/
    └── coding.md     # Coding guidelines
```

## Set Up API Keys

ContextOS uses AI for intelligent features. Set your API key:

::: code-group

```bash [Gemini (recommended)]
export GEMINI_API_KEY="your-key-here"
```

```bash [OpenAI]
export OPENAI_API_KEY="your-key-here"
```

```bash [Anthropic]
export ANTHROPIC_API_KEY="your-key-here"
```

:::

## Index Your Codebase

Build the project index (one-time, then incremental):

```bash
ctx index
```

This creates:
- Dependency graph of all files
- Vector embeddings for semantic search
- AST analysis for code structure

## Build Your First Context

Now you can build optimized context for any goal:

```bash
# With explicit goal
ctx goal "Add rate limiting to AuthController"

# Or auto-infer from git changes
ctx build
```

## Copy and Use

Copy the context to your clipboard:

```bash
ctx copy
```

Then paste into your AI assistant (ChatGPT, Claude, Gemini) with perfect context!

## Next Steps

- [Core Concepts](/guide/concepts) - Understand how ContextOS works
- [context.yaml Reference](/guide/context-yaml) - Configure your project
- [CLI Commands](/cli/) - Explore all commands
