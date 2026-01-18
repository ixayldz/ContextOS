# Getting Started

This guide will get you up and running with ContextOS in under 5 minutes.

## Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **A project** - Any codebase in TypeScript, JavaScript, Python, Go, Rust, or Java
- **An AI tool** - Claude, Cursor, VS Code, Codex CLI, etc.

## Step 1: Setup Your AI Tools

The easiest way to start is with our universal setup:

```bash
npx @contextos/setup
```

This automatically detects and configures all your installed AI tools:

```
🚀 ContextOS Universal Setup

Found 4 AI tool(s)

🖥️  IDEs:
   Claude Desktop MCP
   Cursor MCP

⌨️  CLI Tools:
   Claude Code CLI MCP
   Codex CLI Wrapper

✅ Setup complete: 4/4 tools configured
```

## Step 2: Initialize Your Project

Navigate to your project and initialize ContextOS:

```bash
cd your-project
npx @contextos/cli init
```

This creates a `.contextos` directory with:

```
.contextos/
├── context.yaml      # Project configuration
├── db/               # Vector index database
└── cache/            # Built context cache
```

## Step 3: Index Your Codebase

Build the semantic index:

```bash
npx @contextos/cli index
```

This:
1. Parses your code with Tree-sitter
2. Builds a dependency graph
3. Creates vector embeddings for semantic search

## Step 4: Set a Goal & Build Context

```bash
# Set what you're working on
npx @contextos/cli goal "Add rate limiting to AuthController"

# Build optimized context
npx @contextos/cli build

# Copy to clipboard
npx @contextos/cli copy
```

Or in one command:

```bash
npx @contextos/cli goal "Add rate limiting to AuthController" --copy
```

## Step 5: Use with Your AI Tool

### With Claude Desktop / Cursor (MCP)

Just start chatting! ContextOS is already integrated:

```
You: Add rate limiting to AuthController

Claude: [Uses contextos_build tool automatically]
        Based on your AuthController.ts and RateLimitMiddleware.ts,
        here's how to add rate limiting...
```

### With CLI Tools (Codex, Gemini)

Use the context-aware wrapper:

```bash
# Use the wrapper command
codex-ctx "Add rate limiting to AuthController"

# Or manually include context
npx @contextos/cli goal "Add rate limiting" --output context.md
codex "Add rate limiting" --context context.md
```

## What's Next?

- [Configuration Guide](/guide/configuration) - Customize context.yaml
- [CLI Commands](/guide/cli-commands) - All available commands
- [How It Works](/concepts/how-it-works) - Understanding the algorithm
- [MCP Integration](/api/mcp) - Advanced MCP usage

## Troubleshooting

### "No index found"

Run `npx @contextos/cli index` first.

### "Context too large"

Reduce token budget in context.yaml:

```yaml
budget:
  maxTokens: 50000  # Reduce from default
```

### "File not included"

Add important files to constraints:

```yaml
constraints:
  alwaysInclude:
    - src/core/**/*.ts
```

## Need Help?

- [GitHub Issues](https://github.com/ixayldz/ContextOS/issues)
- [Discussions](https://github.com/ixayldz/ContextOS/discussions)
