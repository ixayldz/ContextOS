# MCP API Reference

ContextOS exposes its functionality through the **Model Context Protocol** (MCP), enabling seamless integration with AI tools like Claude, Cursor, and Windsurf.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Tool                                  │
│  (Claude Desktop, Cursor, Windsurf, etc.)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ MCP Protocol (JSON-RPC)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   @contextos/mcp                             │
├─────────────────────────────────────────────────────────────┤
│  Tools      │  Resources    │  Prompts                      │
│  (Actions)  │  (Data)       │  (Templates)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   @contextos/core                            │
└─────────────────────────────────────────────────────────────┘
```

## Tools

Tools are actions the AI can invoke.

### `contextos_build`

Build optimized context for a goal.

**Input:**
```json
{
  "goal": "Add rate limiting to AuthController",
  "budget": 50000,
  "format": "markdown"
}
```

**Output:**
```json
{
  "context": "# Project Context\n\n## AuthController.ts\n...",
  "files": ["src/auth/AuthController.ts", "src/api/RateLimiter.ts"],
  "tokens": 4520
}
```

---

### `contextos_analyze`

Deep analysis using the RLM engine.

**Input:**
```json
{
  "goal": "Optimize database queries",
  "depth": 3,
  "model": "gemini-pro"
}
```

**Output:**
```json
{
  "analysis": "Based on my analysis...",
  "files_analyzed": 15,
  "suggestions": [
    "Add index on users.email",
    "Use batch queries in UserRepository"
  ],
  "execution_time_ms": 2450
}
```

---

### `contextos_find`

Find files matching a pattern or description.

**Input:**
```json
{
  "query": "authentication",
  "type": "semantic"
}
```

**Output:**
```json
{
  "files": [
    {"path": "src/auth/AuthController.ts", "score": 0.95},
    {"path": "src/auth/AuthService.ts", "score": 0.88},
    {"path": "src/middleware/jwt.ts", "score": 0.72}
  ]
}
```

---

### `contextos_deps`

Get dependencies for a file.

**Input:**
```json
{
  "file": "src/auth/AuthController.ts",
  "depth": 2,
  "direction": "both"
}
```

**Output:**
```json
{
  "imports": [
    "src/auth/AuthService.ts",
    "src/models/User.ts"
  ],
  "imported_by": [
    "src/routes/auth.ts"
  ],
  "graph": {
    "nodes": [...],
    "edges": [...]
  }
}
```

---

### `contextos_explain`

Get an explanation of a file or symbol.

**Input:**
```json
{
  "file": "src/auth/AuthController.ts",
  "symbol": "login",
  "include_deps": true
}
```

**Output:**
```json
{
  "explanation": "The `login` method handles user authentication...",
  "purpose": "User authentication endpoint",
  "dependencies": ["AuthService", "UserRepository"],
  "complexity": "medium"
}
```

---

### `contextos_status`

Get ContextOS status for current project.

**Input:** None

**Output:**
```json
{
  "initialized": true,
  "indexed": true,
  "files_indexed": 234,
  "last_index": "2024-01-15T10:30:00Z",
  "goal": "Add rate limiting to AuthController",
  "config": {
    "budget": 50000,
    "language": "typescript"
  }
}
```

---

## Resources

Resources are data endpoints the AI can read.

### `contextos://context/current`

The most recently built context.

**Example:**
```markdown
# Project Context

## Goal
Add rate limiting to AuthController

## Files

### src/auth/AuthController.ts
```typescript
export class AuthController {
  // ...
}
```

### src/api/RateLimiter.ts
```typescript
export class RateLimiter {
  // ...
}
```
```

---

### `contextos://project/info`

Project metadata and configuration.

**Example:**
```json
{
  "name": "my-api",
  "language": "typescript",
  "framework": "express",
  "files": 234,
  "config": {
    "budget": 50000,
    "weights": {
      "semantic": 0.4,
      "dependency": 0.4,
      "rules": 0.2
    }
  }
}
```

---

### `contextos://project/constraints`

Project constraints and rules.

**Example:**
```json
{
  "alwaysInclude": [
    "src/types/**/*.ts"
  ],
  "neverInclude": [
    "**/*.test.ts",
    "**/node_modules/**"
  ],
  "boundaries": [
    {
      "from": "src/api/**",
      "to": "src/db/**",
      "type": "warn"
    }
  ]
}
```

---

### `contextos://project/structure`

Project file tree.

**Example:**
```
src/
├── auth/
│   ├── AuthController.ts
│   ├── AuthService.ts
│   └── types.ts
├── api/
│   ├── RateLimiter.ts
│   └── handlers/
│       └── user.ts
└── models/
    └── User.ts
```

---

## Prompts

Prompts are conversation templates.

### `code_with_context`

Start a coding session with full context.

**Arguments:**
- `goal` (required): What you want to accomplish

**Template:**
```
I'm working on: {{goal}}

Here's the relevant context from my codebase:

{{context}}

Please help me implement this. Consider:
1. Existing patterns in the codebase
2. Dependencies between files
3. Best practices for this stack
```

---

### `review_code`

Review code with full dependency context.

**Arguments:**
- `file` (required): File to review

**Template:**
```
Please review this file:

{{file_content}}

Dependencies:
{{dependencies}}

Dependents (files that use this):
{{dependents}}

Look for:
1. Potential bugs
2. Performance issues
3. Code style improvements
```

---

### `debug_issue`

Debug an issue with relevant context.

**Arguments:**
- `issue` (required): Description of the issue
- `file` (optional): Related file

**Template:**
```
I'm experiencing this issue: {{issue}}

Related code:
{{context}}

Error logs (if any):
{{logs}}

Please help me debug this by:
1. Identifying the root cause
2. Suggesting fixes
3. Preventing similar issues
```

---

## Configuration

### Manual Setup

If you prefer manual configuration:

**Claude Desktop:**
```json
// ~/.config/claude/claude_desktop_config.json
{
  "mcpServers": {
    "contextos": {
      "command": "npx",
      "args": ["-y", "@contextos/mcp"]
    }
  }
}
```

**Cursor / Windsurf:**
```json
// settings.json
{
  "mcp.servers": {
    "contextos": {
      "command": "npx @contextos/mcp",
      "cwd": "${workspaceFolder}"
    }
  }
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CONTEXTOS_PROJECT_PATH` | Override project path |
| `CONTEXTOS_LOG_LEVEL` | MCP server log level |
| `CONTEXTOS_TELEMETRY` | Enable/disable telemetry |

---

## Error Handling

MCP errors follow the standard format:

```json
{
  "error": {
    "code": "E2001",
    "message": "Index not found. Run 'ctx index' first.",
    "suggestions": [
      {
        "action": "Build the index",
        "command": "ctx index"
      }
    ]
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| E1001 | Config not found |
| E2001 | Index not found |
| E3001 | API key missing |
| E4001 | RLM depth exceeded |

---

## Best Practices

1. **Set clear goals** - Specific goals yield better context
2. **Keep index fresh** - Run `ctx index` after major changes
3. **Use constraints** - Define always/never include patterns
4. **Monitor tokens** - Check context size vs budget
