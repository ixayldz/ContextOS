# ContextOS MCP Server

Model Context Protocol (MCP) server that enables AI tools like **Claude Code**, **Cursor**, **Windsurf** to access optimized context from ContextOS.

## Features

### 🔧 Tools
AI can perform these actions:

| Tool | Description |
|------|-------------|
| `contextos_build` | Build optimized context for a goal |
| `contextos_analyze` | Deep RLM-powered analysis |
| `contextos_find` | Find files by pattern |
| `contextos_deps` | Get file dependencies |
| `contextos_explain` | Get file explanation |
| `contextos_status` | Check ContextOS status |

### 📚 Resources
AI can read these data sources:

| Resource | Description |
|----------|-------------|
| `contextos://context/current` | Last built context |
| `contextos://project/info` | Project configuration |
| `contextos://project/constraints` | Coding rules |
| `contextos://project/structure` | Directory tree |

### 💬 Prompts
Pre-built prompt templates:

| Prompt | Description |
|--------|-------------|
| `code_with_context` | Start coding with context |
| `review_code` | Review file with deps |
| `debug_issue` | Debug with context |

---

## Installation

### For Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "contextos": {
      "command": "npx",
      "args": ["@contextos/mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### For Cursor

Add to Cursor settings:

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

### Global Installation

```bash
npm install -g @contextos/mcp
contextos-mcp
```

---

## Usage

Once configured, the AI tool will automatically have access to ContextOS features.

### Example: Building Context

The AI can call:
```
Use the contextos_build tool with goal "Add authentication to UserController"
```

And receive optimized context automatically.

### Example: Reading Project Info

The AI can read:
```
Read the contextos://project/info resource
```

---

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run locally
pnpm start
```

---

## License

MIT
