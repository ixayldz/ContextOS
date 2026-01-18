# @contextos/mcp

**Model Context Protocol server for ContextOS**

[![npm version](https://img.shields.io/npm/v/@contextos/mcp?style=flat-square)](https://www.npmjs.com/package/@contextos/mcp)

Enables AI coding tools to access ContextOS's optimized context through the [Model Context Protocol](https://modelcontextprotocol.io/).

## 🎯 Supported Tools

| Tool | Integration |
|------|-------------|
| Claude Desktop | ✅ Native MCP |
| Claude Code CLI | ✅ Native MCP |
| Cursor | ✅ Native MCP |
| Windsurf | ✅ Native MCP |
| Kilo Code | ✅ Native MCP |
| VS Code + Continue.dev | ✅ Native MCP |

## 🚀 Quick Setup

### Recommended: Use Universal Setup

```bash
npx @contextos/setup
```

This automatically configures all your AI tools.

### Manual Configuration

#### Claude Desktop / Claude Code CLI

Add to `~/.config/claude/claude_desktop_config.json` (Linux/macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "contextos": {
      "command": "npx",
      "args": ["-y", "@contextos/mcp"]
    }
  }
}
```

#### Cursor

Add to settings.json:

```json
{
  "mcp.servers": {
    "contextos": {
      "command": "npx @contextos/mcp",
      "cwd": "${workspaceFolder}"
    }
  }
}
```

#### Windsurf

Add to settings.json:

```json
{
  "mcp.servers": {
    "contextos": {
      "command": "npx @contextos/mcp",
      "cwd": "${workspaceFolder}"
    }
  }
}
```

## 🔧 MCP Capabilities

### Tools

| Tool | Description |
|------|-------------|
| `contextos_build` | Build optimized context for a goal |
| `contextos_analyze` | Deep analysis using RLM engine |
| `contextos_find` | Find files matching a pattern |
| `contextos_deps` | Get file dependencies |
| `contextos_explain` | Explain a file's purpose |
| `contextos_status` | Get ContextOS status |

### Resources

| Resource | Description |
|----------|-------------|
| `contextos://context/current` | Current built context |
| `contextos://project/info` | Project information |
| `contextos://project/constraints` | Coding constraints |
| `contextos://project/structure` | File tree structure |

### Prompts

| Prompt | Description |
|--------|-------------|
| `code_with_context` | Start coding with full context |
| `review_code` | Review code with dependencies |
| `debug_issue` | Debug with relevant context |

## 📋 Usage Examples

Once configured, your AI assistant can use ContextOS automatically:

**Example Chat:**

```
You: Add rate limiting to the AuthController

AI: [Calls contextos_build("Add rate limiting to AuthController")]
AI: Based on the context, I can see AuthController.ts imports RateLimitMiddleware...
    Here's the implementation:
    ...
```

**Example with Tools:**

```
You: What does PaymentService depend on?

AI: [Calls contextos_deps("src/payment/PaymentService.ts")]
AI: PaymentService depends on:
    - src/payment/StripeClient.ts
    - src/user/UserRepository.ts
    - src/common/Logger.ts
```

## 🏗️ How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Tool (Cursor, Claude, etc.)           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ MCP Protocol
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    @contextos/mcp                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    Tools     │  │  Resources   │  │   Prompts    │       │
│  │  (Actions)   │  │   (Data)     │  │ (Templates)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 @contextos/core                      │    │
│  │  RLM Engine | Hybrid Ranker | Parser | Graph | etc.  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Your Codebase                             │
│  .contextos/ | src/ | package.json | ...                     │
└─────────────────────────────────────────────────────────────┘
```

## 🔍 Debugging

### Check if MCP server starts correctly

```bash
npx @contextos/mcp
```

You should see: `ContextOS MCP Server started`

### Enable debug logging

```bash
DEBUG=contextos:* npx @contextos/mcp
```

### Check tool logs

Most MCP-compatible tools have a developer console or log file where you can see MCP communication.

## 📦 Requirements

- Node.js 18+
- A ContextOS-initialized project (`npx @contextos/cli init`)
- An MCP-compatible AI tool

## 🤝 Contributing

Found an issue or want to add support for a new tool? Open an issue or PR!

## 📄 License

MIT © ContextOS Team
