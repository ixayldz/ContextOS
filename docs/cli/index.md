# CLI Commands

ContextOS provides 13 CLI commands for managing your context.

## Core Commands

| Command | Description |
|---------|-------------|
| [`ctx init`](/cli/init) | Initialize ContextOS in project |
| [`ctx index`](/cli/index) | Build/update project index |
| [`ctx build`](/cli/build) | Auto-infer goal from git diff |
| [`ctx goal`](/cli/goal) | Build context for specific goal |

## Context Management

| Command | Description |
|---------|-------------|
| [`ctx preview`](/cli/preview) | Preview context without copying |
| [`ctx copy`](/cli/copy) | Copy last context to clipboard |
| [`ctx config`](/cli/config) | View/edit configuration |

## AI-Powered (RLM)

| Command | Description |
|---------|-------------|
| [`ctx analyze`](/cli/analyze) | Deep codebase analysis |
| [`ctx refactor`](/cli/refactor) | Safe refactoring with impact analysis |
| [`ctx explain`](/cli/explain) | AI-powered code explanation |
| [`ctx trace`](/cli/trace) | Trace function call chains |

## Maintenance

| Command | Description |
|---------|-------------|
| [`ctx doctor`](/cli/doctor) | Check for configuration drift |
| [`ctx suggest-rules`](/cli/suggest-rules) | AI-suggested coding constraints |

## Quick Examples

```bash
# Initialize and index
ctx init
ctx index

# Build context for a goal
ctx goal "Add rate limiting to API" -c

# Deep analysis with RLM
ctx analyze "Find security vulnerabilities"

# Safe refactoring
ctx refactor "Rename User to Account" --dry-run

# Get code explanation
ctx explain src/auth/service.ts
```

## Global Options

All commands support these options:

| Option | Description |
|--------|-------------|
| `-v, --verbose` | Enable verbose output |
| `--help` | Show help for command |
