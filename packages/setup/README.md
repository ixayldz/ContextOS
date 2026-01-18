# @contextos/setup

**Universal setup for ContextOS - one command to configure all AI coding tools**

[![npm version](https://img.shields.io/npm/v/@contextos/setup?style=flat-square)](https://www.npmjs.com/package/@contextos/setup)

```bash
npx @contextos/setup
```

## 🎯 What It Does

This package automatically detects and configures ContextOS for **all your AI coding tools**:

### ✅ Supported Tools

| Tool | Type | MCP Support | Auto-Configure |
|------|------|-------------|----------------|
| **Claude Desktop** | IDE | ✅ Native | ✅ |
| **Claude Code CLI** | CLI | ✅ Native | ✅ |
| **Cursor** | IDE | ✅ Native | ✅ |
| **Windsurf** | IDE | ✅ Native | ✅ |
| **VS Code** | IDE | 🔌 Extension | ✅ |
| **Kilo Code** | IDE | ✅ Native | ✅ |
| **Codex CLI** | CLI | 📦 Wrapper | ✅ |
| **Gemini CLI** | CLI | 📦 Wrapper | ✅ |
| **OpenCode CLI** | CLI | 📦 Wrapper | ✅ |
| **Warp Terminal** | Terminal | 📦 Wrapper | ✅ |

- ✅ **Native MCP**: Direct config injection, works immediately
- 🔌 **Extension**: Needs VS Code extension (Continue.dev)
- 📦 **Wrapper**: Creates wrapper script for context injection

## 🚀 Quick Start

### One-Command Setup

```bash
# Detect and configure ALL AI tools
npx @contextos/setup

# Example output:
# 🚀 ContextOS Universal Setup
#
# Found 4 AI tool(s)
#
# 🖥️  IDEs:
#    Claude Desktop MCP
#    Cursor MCP
#
# ⌨️  CLI Tools:
#    Claude Code CLI MCP
#    Codex CLI Wrapper
#
# ✓ Claude Desktop: MCP configuration added
# ✓ Cursor: MCP configuration added
# ✓ Claude Code CLI: MCP configuration added
# ✓ Codex CLI: Wrapper script created
#     → Add ~/.local/bin to your PATH
#     → Use 'codex-ctx' instead of 'codex'
#
# ✅ Setup complete: 4/4 tools configured
```

## 📋 Commands

### `npx @contextos/setup` (or `npx @contextos/setup auto`)

Automatically detect and configure all tools.

**Options:**
- `--dry-run` - Preview without making changes
- `--force` - Overwrite existing configurations
- `--only-mcp` - Only configure tools with native MCP support
- `--only-cli` - Only configure CLI tools
- `--only-ide` - Only configure IDE apps

### `npx @contextos/setup list`

List all detected AI tools and their status.

```bash
npx @contextos/setup list

# Output:
#   Tool                    Type        MCP Support    Status
#   ────────────────────────────────────────────────────────────
#   🖥️ Claude Desktop        IDE         MCP            Ready
#   🖥️ Cursor                IDE         MCP            Configured
#   ⌨️ Claude Code CLI       CLI         MCP            Ready
#   ⌨️ Codex CLI             CLI         Wrapper        Ready
```

### `npx @contextos/setup configure <tool>`

Configure a specific tool.

```bash
npx @contextos/setup configure cursor
npx @contextos/setup configure codex --force
```

### `npx @contextos/setup hook`

Generate shell hook for automatic context updates.

```bash
npx @contextos/setup hook

# Output shell script to add to ~/.bashrc or ~/.zshrc
```

### `npx @contextos/setup status`

Show integration status overview.

## 🔧 How It Works

### For Native MCP Tools (Claude, Cursor, Windsurf)

We inject configuration directly into the tool's config file:

**Claude Desktop** (`~/.config/claude/claude_desktop_config.json`):
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

**Cursor** (`~/.config/Cursor/User/settings.json`):
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

### For Wrapper Tools (Codex, Gemini CLI)

We create wrapper scripts in `~/.local/bin/`:

```bash
# ~/.local/bin/codex-ctx
#!/bin/bash
# ContextOS wrapper for Codex CLI

# Build context if in a ContextOS project
if [ -d ".contextos" ]; then
    npx @contextos/mcp --build 2>/dev/null
fi

# Run original command with context
codex "$@" --system-prompt "$(cat .contextos/cache/last-context.md)"
```

## 📦 After Setup

1. **Restart your IDE(s)** - Configuration changes require restart
2. **Navigate to a project** - `cd your-project`
3. **Initialize ContextOS** - `npx @contextos/cli init`
4. **Use AI with context!** - Your AI tools now have optimized context

## 🔍 Troubleshooting

### Tool not detected?

Make sure the tool is installed and has created its config directory:

```bash
# Check if config directory exists
ls ~/.config/Cursor/  # Linux/macOS
dir %APPDATA%\Cursor\  # Windows
```

### MCP not working?

1. Check tool's MCP settings
2. Verify `npx @contextos/mcp` runs correctly
3. Check logs in tool's developer console

### Need to reconfigure?

```bash
npx @contextos/setup configure cursor --force
```

## 🤝 Contributing

Found a tool we should support? Open an issue or PR!

## 📄 License

MIT © ContextOS Team
