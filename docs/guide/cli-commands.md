# CLI Commands

Complete reference for all ContextOS CLI commands.

## Installation

```bash
# Global install
npm install -g @contextos/cli

# Or use npx
npx @contextos/cli <command>
```

---

## Core Commands

### `ctx init`

Initialize ContextOS in a project directory.

```bash
ctx init [options]
```

**Options:**
| Flag | Description |
|------|-------------|
| `-y, --yes` | Skip prompts, use defaults |
| `--force` | Overwrite existing configuration |

**Example:**
```bash
ctx init -y
```

---

### `ctx index`

Build the semantic index for your project.

```bash
ctx index [options]
```

**Options:**
| Flag | Description |
|------|-------------|
| `--watch` | Watch for file changes |
| `--force` | Rebuild entire index |
| `--no-embeddings` | Skip vector embeddings |

**Example:**
```bash
ctx index --watch
```

---

### `ctx goal`

Set the current goal for context building.

```bash
ctx goal <goal> [options]
```

**Options:**
| Flag | Description |
|------|-------------|
| `--copy` | Copy context to clipboard |
| `--output <file>` | Save context to file |
| `--budget <tokens>` | Override token budget |

**Example:**
```bash
ctx goal "Add rate limiting to AuthController" --copy
```

---

### `ctx build`

Build context based on current goal.

```bash
ctx build [options]
```

**Options:**
| Flag | Description |
|------|-------------|
| `--goal <goal>` | Specify goal inline |
| `--budget <tokens>` | Override token budget |
| `--format <fmt>` | Output format (markdown, json, xml) |

**Example:**
```bash
ctx build --goal "Fix login bug" --budget 50000
```

---

### `ctx copy`

Copy the last built context to clipboard.

```bash
ctx copy [options]
```

**Options:**
| Flag | Description |
|------|-------------|
| `--format <fmt>` | Output format |

---

### `ctx preview`

Preview context without copying.

```bash
ctx preview [options]
```

---

## Analysis Commands

### `ctx analyze`

Deep analysis using the RLM engine.

```bash
ctx analyze <goal> [options]
```

**Options:**
| Flag | Description |
|------|-------------|
| `--depth <n>` | Maximum recursion depth (default: 3) |
| `--budget <tokens>` | Token budget |
| `--model <model>` | LLM model to use |
| `--verbose` | Show detailed output |

**Example:**
```bash
ctx analyze "Optimize database queries" --depth 5 --model gemini-pro
```

---

### `ctx explain`

Get AI explanation of a file or symbol.

```bash
ctx explain <file> [options]
```

**Options:**
| Flag | Description |
|------|-------------|
| `--symbol <name>` | Explain specific symbol |
| `--with-deps` | Include dependencies |

**Example:**
```bash
ctx explain src/auth/AuthController.ts --with-deps
```

---

### `ctx trace`

Trace dependencies for a file.

```bash
ctx trace <file> [options]
```

**Options:**
| Flag | Description |
|------|-------------|
| `--depth <n>` | Trace depth |
| `--reverse` | Show reverse dependencies |
| `--format <fmt>` | Output format (tree, json, graph) |

**Example:**
```bash
ctx trace src/api/handler.ts --depth 3 --format tree
```

---

## Maintenance Commands

### `ctx doctor`

Check project health and detect issues.

```bash
ctx doctor [options]
```

**Options:**
| Flag | Description |
|------|-------------|
| `--fix` | Auto-fix issues |
| `--ci` | CI mode (exit code on issues) |

**Example:**
```bash
ctx doctor --fix
```

---

### `ctx config`

Manage configuration.

```bash
ctx config <action> [key] [value]
```

**Actions:**
- `get <key>` - Get config value
- `set <key> <value>` - Set config value
- `list` - List all config
- `reset` - Reset to defaults

**Example:**
```bash
ctx config set budget.maxTokens 100000
```

---

## Plugin Commands

### `ctx plugin`

Manage plugins.

```bash
ctx plugin <action> [name]
```

**Actions:**
- `list` - List installed plugins
- `install <name>` - Install a plugin
- `remove <name>` - Remove a plugin
- `update` - Update all plugins

**Example:**
```bash
ctx plugin install @contextos/plugin-django
```

---

## Advanced Commands

### `ctx refactor`

AI-assisted refactoring.

```bash
ctx refactor <goal> [options]
```

**Options:**
| Flag | Description |
|------|-------------|
| `--preview` | Preview changes only |
| `--interactive` | Interactive mode |

---

### `ctx generate`

Generate code with AI.

```bash
ctx generate <description> [options]
```

**Options:**
| Flag | Description |
|------|-------------|
| `--type <type>` | File type (component, service, test) |
| `--output <path>` | Output path |

---

### `ctx finetune`

Fine-tuning data management.

```bash
ctx finetune <action> [options]
```

**Actions:**
- `export` - Export training data
- `validate` - Validate dataset
- `stats` - Show statistics

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `CONTEXTOS_TELEMETRY` | Enable telemetry (true/false) |
| `CONTEXTOS_LOG_LEVEL` | Log level (debug, info, warn, error) |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Configuration error |
| 3 | Index error |
| 4 | API error |
