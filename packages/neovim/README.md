# ContextOS Neovim Plugin

Neovim plugin for ContextOS - The Context Server Protocol for AI Coding.

## Installation

### Using lazy.nvim

```lua
{
    "contextos/contextos.nvim",
    dependencies = {
        "nvim-telescope/telescope.nvim", -- Optional, for Telescope integration
    },
    config = function()
        require("contextos").setup({
            -- Path to ctx CLI (default: "ctx")
            ctx_path = "ctx",
            
            -- Auto-index on save
            auto_index = false,
            
            -- Keymaps
            keymaps = {
                build = "<leader>cb",
                copy = "<leader>cc",
                analyze = "<leader>ca",
                preview = "<leader>cp",
            },
        })
    end,
}
```

### Using packer.nvim

```lua
use {
    "contextos/contextos.nvim",
    requires = { "nvim-telescope/telescope.nvim" },
    config = function()
        require("contextos").setup()
    end,
}
```

## Commands

| Command | Description |
|---------|-------------|
| `:ContextOSBuild [goal]` | Build context for a goal |
| `:ContextOSCopy` | Copy context to clipboard |
| `:ContextOSAnalyze [query]` | Run RLM analysis |
| `:ContextOSPreview` | Preview current context |
| `:ContextOSDoctor` | Run health check |
| `:ContextOSIndex` | Index project |

## Keymaps

Default keymaps (can be customized in setup):

| Keymap | Action |
|--------|--------|
| `<leader>cb` | Build context (interactive) |
| `<leader>cc` | Copy context to clipboard |
| `<leader>ca` | Analyze (interactive) |
| `<leader>cp` | Preview context |

## Telescope Integration

If you have Telescope installed, you can use:

```lua
-- Find files ranked by ContextOS
:Telescope contextos context_files

-- Search recent goals
:Telescope contextos goals

-- View symbols with dependencies
:Telescope contextos symbols
```

## Requirements

- Neovim 0.8+
- ContextOS CLI installed (`npm install -g @contextos/cli`)
- Project initialized with `ctx init`

## License

MIT
