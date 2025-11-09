# API Reference

Complete reference for all MCP CLI commands with examples and output formats.

## Table of Contents

- [Global Options](#global-options)
- [Server Commands](#server-commands)
- [Tool Commands](#tool-commands)
- [Resource Commands](#resource-commands)
- [Prompt Commands](#prompt-commands)
- [Discovery Commands](#discovery-commands)
- [Response Format](#response-format)

## Global Options

All commands support these global options:

| Option            | Description            | Example                     |
| ----------------- | ---------------------- | --------------------------- |
| `--config <path>` | Use custom config file | `--config ./my-config.json` |
| `-v, --verbose`   | Enable verbose logging | `-vv` (trace level)         |

## Server Commands

### `mcp servers list`

List all configured servers.

**Options**:

- `--names-only`: Show only server names (default)
- `--full`: Show detailed information including status
- `--include-disabled`: Include disabled servers

**Examples**:

```bash
# Names only (default)
mcp servers list

# Full details with connection status
mcp servers list --full

# Include disabled servers
mcp servers list --include-disabled
```

**Output** (names-only):

```json
{
  "success": true,
  "data": ["filesystem", "github", "playwright"],
  "metadata": {
    "timestamp": "2025-11-09T12:00:00Z",
    "executionTime": 45,
    "tokensEstimate": 50,
    "resultSize": "small"
  }
}
```

### `mcp servers add`

Add a new server configuration.

**Usage**: `mcp servers add <name> [options]`

**Required Options**:

- `-t, --type <type>`: Transport type (`stdio`, `sse`, or `http`)

**Optional Options**:

- `--command <cmd>`: Command for stdio transport
- `--args <args...>`: Arguments for command
- `--url <url>`: URL for SSE/HTTP transport
- `--api-key <key>`: API key for authentication
- `--env <vars...>`: Environment variables (KEY=value format)
- `--disabled`: Add server in disabled state

**Examples**:

```bash
# Add stdio server
mcp servers add playwright --type stdio \
  --command "npx" --args "-y" "@playwright/mcp@latest"

# Add HTTP server with API key
mcp servers add api-server --type http \
  --url "https://api.example.com" \
  --api-key "sk-..."

# Add server with environment variables
mcp servers add custom --type stdio \
  --command "python" --args "server.py" \
  --env "PORT=3000" "DEBUG=true"
```

### `mcp servers remove <name>`

Remove a server configuration.

### `mcp servers test <name>`

Test connection to a server.

### `mcp servers info <name>`

Get detailed server information and capabilities.

### `mcp inspect <server>`

Get high-level server capabilities summary.

**Output**:

```json
{
  "success": true,
  "data": {
    "tools": 15,
    "resources": 3,
    "prompts": 2,
    "capabilities": ["tools", "resources", "prompts"]
  }
}
```

### `mcp servers init`

Initialize MCP configuration file.

**Options**:

- `--local`: Create config in current directory (`.mcp-cli.json`)
- `--path <path>`: Create config at specific path
- `--force`: Overwrite existing configuration

**Examples**:

```bash
# Create global config
mcp servers init

# Create local config in project
mcp servers init --local

# Create at custom path
mcp servers init --path ~/my-config.json

# Force overwrite existing
mcp servers init --force
```

## Tool Commands

### `mcp tools list <server>`

List tools from a server with progressive disclosure.

**Options**:

- `--names-only`: Show only tool names (default, ~100 tokens)
- `--brief`: Show names and descriptions (~500 tokens)
- `--full`: Show complete schemas (~2000+ tokens)

**Examples**:

```bash
# Names only (default)
mcp tools list playwright

# With brief descriptions
mcp tools list playwright --brief

# Full schemas (use sparingly)
mcp tools list playwright --full
```

### `mcp tools schema <server> <tools...>`

Get schemas for specific tools (just-in-time loading).

**Examples**:

```bash
# Single tool
mcp tools schema playwright browser_navigate

# Multiple tools
mcp tools schema playwright browser_navigate browser_screenshot
```

**Output** (single tool):

```json
{
  "success": true,
  "data": {
    "name": "browser_navigate",
    "description": "Navigate browser to a URL",
    "inputSchema": {
      "type": "object",
      "properties": {
        "url": { "type": "string", "description": "URL to navigate to" }
      },
      "required": ["url"]
    }
  }
}
```

### `mcp tools exec <server> <tool>`

Execute a tool.

**Options**:

- `--args <json>`: Tool arguments as JSON (required)
- `--max-tokens <num>`: Limit response size

**Examples**:

```bash
# Simple execution
mcp tools exec filesystem read_file \
  --args '{"path":"config.json"}'

# With token limit
mcp tools exec filesystem read_file \
  --args '{"path":"large.log"}' \
  --max-tokens 500
```

### `mcp tools batch <server>`

Execute multiple tools sequentially without disconnecting.

**Options**:

- `--operations <json>`: Array of operations (required)
- `--transactional`: Fail entire batch on first error

**Operations Format**:

```json
[
  {"tool": "tool_name", "args": {...}, "outputVar": "optional_var_name"},
  {"tool": "another_tool", "args": {...}}
]
```

**Examples**:

```bash
# Non-transactional batch (continues on errors)
mcp tools batch playwright --operations '[
  {"tool":"browser_navigate","args":{"url":"https://example.com"}},
  {"tool":"browser_screenshot","args":{"filename":"page.png"}}
]'

# Transactional batch (atomic)
mcp tools batch database --transactional --operations '[
  {"tool":"begin_transaction","args":{}},
  {"tool":"insert_record","args":{"table":"users","data":{...}}},
  {"tool":"commit_transaction","args":{}}
]'
```

**Output**:

```json
{
  "success": true,
  "data": {
    "operations": [
      {
        "tool": "browser_navigate",
        "result": {"content": [...]},
        "executionTime": 1234,
        "outputVar": null
      },
      {
        "tool": "browser_screenshot",
        "result": {"content": [...]},
        "executionTime": 567
      }
    ],
    "summary": {
      "total": 2,
      "succeeded": 2,
      "failed": 0
    }
  },
  "metadata": {
    "server": "playwright",
    "executionTime": 1801
  }
}
```

### `mcp tools search <server> <query>`

Search for tools on a specific server.

## Resource Commands

### `mcp resources list <server>`

List resources from a server.

**Options**:

- `--names-only`: Show only resource URIs

### `mcp resources read <server> <uri>`

Read a specific resource.

**Options**:

- `--max-tokens <num>`: Limit response size

### `mcp resources schema <server> <uri>`

Get resource metadata/schema.

### `mcp resources search <server> <pattern>`

Search resources by pattern.

## Prompt Commands

### `mcp prompts list <server>`

List available prompts from a server.

**Options**:

- `--names-only`: Show only prompt names

### `mcp prompts schema <server> <prompt>`

Get prompt schema (shows required arguments).

### `mcp prompts get <server> <prompt>`

Get/execute a prompt with arguments.

**Options**:

- `--args <json>`: Prompt arguments as JSON

## Discovery Commands

### `mcp search <query>`

Search for tools across all enabled servers.

**Options**:

- `--limit <num>`: Limit number of results
- `--detailed`: Include brief descriptions

**Examples**:

```bash
# Basic search
mcp search "file operations"

# Detailed search with limit
mcp search "database" --detailed --limit 5
```

**Output**:

```json
{
  "success": true,
  "data": {
    "filesystem": ["read_file", "write_file"],
    "database": ["query", "insert"]
  }
}
```

### `mcp recommend <task>`

Get AI-powered tool recommendations for a task.

**Examples**:

```bash
mcp recommend "I need to search for files and create a report"
```

**Output**:

```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "server": "filesystem",
        "tool": "file_search",
        "description": "Search for files matching a pattern",
        "confidence": 0.85
      },
      {
        "server": "reporting",
        "tool": "generate_report",
        "description": "Generate a report from data",
        "confidence": 0.72
      }
    ]
  }
}
```

### `mcp discover [query]` (New)

Unified discovery command with intelligent defaults.

**Without query**: Lists all servers with capability counts

```bash
mcp discover
```

**Output**:

```json
{
  "success": true,
  "data": {
    "servers": [
      { "name": "filesystem", "tools": 15, "resources": 5, "enabled": true },
      { "name": "playwright", "tools": 20, "resources": 0, "enabled": true }
    ]
  }
}
```

**With query**: Combined search + recommendations + suggested workflow

```bash
mcp discover "navigate to webpage and take screenshot"
```

**Output**:

```json
{
  "success": true,
  "data": {
    "servers": [
      { "name": "playwright", "tools": 20, "enabled": true }
    ],
    "matches": [
      {
        "server": "playwright",
        "tool": "browser_navigate",
        "description": "Navigate browser to a URL",
        "confidence": 0.88
      },
      {
        "server": "playwright",
        "tool": "browser_screenshot",
        "description": "Capture a screenshot of the page",
        "confidence": 0.92
      }
    ],
    "suggested_batch": {
      "server": "playwright",
      "operations": ["browser_navigate", "browser_screenshot"]
    }
  }
}
```

## Response Format

All commands return JSON with this structure:

### Success Response

```json
{
  "success": true,
  "data": <result_data>,
  "metadata": {
    "server": "server_name",
    "timestamp": "2025-11-09T12:00:00Z",
    "executionTime": 145,
    "tokensEstimate": 250,
    "resultSize": "small",
    "truncated": false
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "suggestion": "Helpful suggestion for fixing the error",
    "similar": ["similar_item1", "similar_item2"]
  }
}
```

### Common Error Codes

| Code               | Description                  | Common Cause              |
| ------------------ | ---------------------------- | ------------------------- |
| `SERVER_NOT_FOUND` | Server doesn't exist         | Typo in server name       |
| `TOOL_NOT_FOUND`   | Tool doesn't exist on server | Typo in tool name         |
| `SERVER_DISABLED`  | Server is disabled           | Server disabled in config |
| `SERVER_TIMEOUT`   | Connection timed out         | Server unresponsive       |
| `VALIDATION_ERROR` | Invalid arguments            | Missing required args     |
| `CONNECTION_ERROR` | Cannot connect to server     | Server not running        |

### Metadata Fields

| Field            | Type    | Description                                       |
| ---------------- | ------- | ------------------------------------------------- |
| `server`         | string  | Server name (when applicable)                     |
| `timestamp`      | ISO8601 | When response was generated                       |
| `executionTime`  | number  | Milliseconds to execute                           |
| `tokensEstimate` | number  | Estimated tokens (~4 chars/token)                 |
| `resultSize`     | enum    | "small" (<500), "medium" (<2000), "large" (≥2000) |
| `truncated`      | boolean | Whether output was truncated                      |

## Progressive Disclosure Summary

| Level        | Tokens   | Use Case  | Commands                                  |
| ------------ | -------- | --------- | ----------------------------------------- |
| **Minimal**  | 50-100   | Discovery | `servers list`, `tools list --names-only` |
| **Moderate** | 500-1000 | Selection | `tools list --brief`, `search --detailed` |
| **Full**     | 2000+    | Execution | `tools schema`, `tools exec`              |

## Exit Codes

| Code | Meaning                                |
| ---- | -------------------------------------- |
| 0    | Success                                |
| 1    | Error (see error response for details) |

---

For integration patterns and workflows, see:

- [Agent Integration Guide](./AGENT_INTEGRATION.md)
- [Workflows](./WORKFLOWS.md)
- [Main README](../README.md)
