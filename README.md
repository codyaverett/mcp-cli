# MCP CLI Bridge

**Progressive Disclosure CLI for Model Context Protocol Servers**

A cross-platform command-line tool that enables AI assistants to interact with Model Context Protocol (MCP) servers through shell access, solving the fundamental problem of context pollution in LLM tool architectures.

[![JSR](https://jsr.io/badges/@cosmic/mcp-cli)](https://jsr.io/@cosmic/mcp-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why This Matters

Traditional MCP integrations load **all** tool definitions upfront, polluting the LLM's context with irrelevant information:

- **Token Bloat**: 100+ tools can consume 20-50K tokens
- **Attention Degradation**: Transformers can't truly ignore irrelevant context
- **Reduced Quality**: Model performance degrades with unnecessary information

### The Solution: Progressive Disclosure

MCP CLI implements **lazy loading** of tool schemas:

```bash
# Traditional approach: Load everything (35,000 tokens)
❌ Load all 125 tools from 6 servers upfront

# MCP CLI approach: Load only what's needed (350 tokens)
✅ mcp servers list --names-only        # ~50 tokens
✅ mcp tools list filesystem --names-only  # ~100 tokens
✅ mcp tools schema filesystem read_file   # ~200 tokens
✅ mcp tools exec filesystem read_file --args '{"path": "README.md"}'
```

**Result**: 99% reduction in context pollution, measurably better reasoning quality.

## Features

- **Progressive Disclosure**: Default to minimal output, escalate only when needed
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **AI Platform Agnostic**: Works with Claude, ChatGPT, GitHub Copilot, or any custom agent
- **Multiple Transports**: Supports stdio, SSE, and HTTP MCP servers
- **JSON Output**: Consistent, parseable responses for AI assistants
- **Context-Aware**: Includes token estimates in all responses
- **User-Friendly Errors**: Suggestions for self-correction

## Quick Start

### Installation

**Deno (recommended)**:
```bash
deno install -g -A -n mcp jsr:@cosmic/mcp-cli
```

**npm**:
```bash
npx jsr:@cosmic/mcp-cli
```

**Standalone binary**:
Download from [releases](https://github.com/cosmic/mcp-cli/releases)

### Basic Usage

```bash
# Initialize MCP configuration
mcp servers init                    # Create global config at ~/.mcp-cli/config.json
mcp servers init --local            # Create local config at ./.mcp-cli.json
mcp servers init --path ./my-config.json  # Create config at custom path

# Add a server
mcp servers add filesystem --type stdio \
  --command npx \
  --args "-y" "@modelcontextprotocol/server-filesystem" "/path/to/allowed/directory"

# List servers (minimal)
mcp servers list --names-only

# List tools (minimal - default)
mcp tools list filesystem --names-only

# Get specific tool schema (just-in-time)
mcp tools schema filesystem read_file

# Execute a tool
mcp tools exec filesystem read_file --args '{"path": "README.md"}'

# Search across all servers
mcp search "file operations"
```

## Progressive Disclosure Workflow

The CLI implements a three-tier disclosure pattern:

### 1. Names Only (Minimal Context)
```bash
# Get server names (~50 tokens)
mcp servers list --names-only
# ["filesystem", "github", "slack"]

# Get tool names (~100-200 tokens)
mcp tools list github --names-only
# ["create_issue", "get_issue", "update_issue", ...]
```

### 2. Brief Descriptions (Moderate Context)
```bash
# Get tool descriptions (~500-1000 tokens)
mcp tools list github --brief
# [{"name": "create_issue", "description": "Create a new GitHub issue"}, ...]
```

### 3. Full Schemas (High Context - Explicit Only)
```bash
# Load complete schema when about to use (~200-500 tokens per tool)
mcp tools schema github create_issue
# {"name": "create_issue", "inputSchema": {...}}
```

## Configuration

### Config File Discovery

MCP CLI supports both global and project-specific configurations with automatic discovery:

**Priority order** (highest to lowest):
1. **--config flag**: `mcp --config ./custom.json servers list`
2. **MCP_CONFIG env var**: `MCP_CONFIG=./custom.json mcp servers list`
3. **Local config**: `.mcp-cli.json` in current directory
4. **Parent search**: Walks up directory tree to find `.mcp-cli.json`
5. **Global config**: `~/.mcp-cli/config.json` (or platform-specific location)

**Default global config locations**:
- **Windows**: `%USERPROFILE%\.mcp-cli\config.json`
- **macOS/Linux**: `~/.mcp-cli/config.json`
- **Linux (XDG)**: `$XDG_CONFIG_HOME/mcp-cli/config.json`

### Initialization

Create a new config file with default settings:

```bash
# Create global config
mcp servers init

# Create local project config
mcp servers init --local

# Create config at custom path
mcp servers init --path ./configs/mcp.json

# Overwrite existing config
mcp servers init --force
```

### Configuration Example
```json
{
  "servers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "enabled": true
    },
    "github": {
      "type": "sse",
      "url": "http://localhost:3000/sse",
      "apiKey": "${GITHUB_TOKEN}",
      "enabled": true
    }
  },
  "preferences": {
    "defaultTimeout": 30000,
    "cacheSchemas": true,
    "cacheTTL": 300
  }
}
```

Environment variables are supported with `${VAR_NAME}` syntax.

### Use Cases

**Global config for personal tools**:
```bash
mcp servers init
mcp servers add my-tool --type stdio --command my-global-tool
```

**Project-specific config** (committed to git):
```bash
cd my-project
mcp servers init --local
mcp servers add project-db --type stdio --command ./scripts/db-tool.sh
git add .mcp-cli.json
```

**Temporary config override**:
```bash
MCP_CONFIG=./test-config.json mcp tools list test-server
```

## Commands

### Server Management
- `mcp servers init [--local] [--path <path>] [--force]` - Initialize config file
- `mcp servers list [--names-only] [--full]` - List servers
- `mcp servers add <name> --type <stdio|sse|http>` - Add server
- `mcp servers remove <name>` - Remove server
- `mcp servers test <name>` - Test connection
- `mcp servers info <name>` - Get detailed info
- `mcp inspect <name>` - Get capabilities summary

### Tool Operations
- `mcp tools list <server> [--names-only] [--brief] [--full]` - List tools
- `mcp tools schema <server> <tool...>` - Get tool schema(s)
- `mcp tools exec <server> <tool> --args <json>` - Execute tool
- `mcp tools search <server> <query>` - Search tools

### Resource Operations
- `mcp resources list <server> [--names-only]` - List resources
- `mcp resources read <server> <uri>` - Read resource
- `mcp resources schema <server> <uri>` - Get resource metadata
- `mcp resources search <server> <pattern>` - Search resources

### Prompt Operations
- `mcp prompts list <server> [--names-only]` - List prompts
- `mcp prompts schema <server> <prompt>` - Get prompt schema
- `mcp prompts get <server> <prompt> [--args <json>]` - Get prompt

### Discovery
- `mcp search <query> [--detailed]` - Search across all servers
- `mcp recommend <task-description>` - Get tool recommendations

## Usage with AI Assistants

### Claude (via bash_tool)
```python
# Step 1: Discover servers
servers = bash_tool('mcp servers list --names-only')

# Step 2: Find relevant tools
tools = bash_tool('mcp tools list filesystem --names-only')

# Step 3: Load schema for specific tool
schema = bash_tool('mcp tools schema filesystem read_file')

# Step 4: Execute
result = bash_tool('mcp tools exec filesystem read_file --args \'{"path": "file.txt"}\'')
```

### ChatGPT (Code Interpreter)
```python
import subprocess
import json

result = subprocess.run(
    ['mcp', 'servers', 'list', '--names-only'],
    capture_output=True,
    text=True
)
servers = json.loads(result.stdout)
```

### Custom Agents
```javascript
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const { stdout } = await execAsync('mcp servers list --names-only');
const result = JSON.parse(stdout);
```

## Response Format

All commands output JSON:

**Success**:
```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "server": "filesystem",
    "timestamp": "2025-11-08T12:00:00Z",
    "executionTime": 145,
    "tokensEstimate": 250,
    "resultSize": "small"
  }
}
```

**Error**:
```json
{
  "success": false,
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "Tool 'invalid' not found on server 'filesystem'",
    "suggestion": "Try: mcp tools list filesystem --names-only",
    "similar": ["read_file", "write_file"]
  }
}
```

## Development

```bash
# Run from source
deno task dev servers list --names-only

# Run tests
deno task test

# Lint and format
deno task lint
deno task fmt

# Type check
deno task check

# Compile binaries
deno task compile
```

## Architecture

The CLI follows clean architecture principles:

```
src/
├── types/          # TypeScript type definitions
├── utils/          # Cross-platform utilities
├── config/         # Configuration management
├── client/         # MCP client implementations
├── commands/       # Command handlers
├── cli.ts          # CLI entry point
└── mod.ts          # Module exports
```

Key design decisions:
- **Minimal by default**: All list operations default to `--names-only`
- **Explicit schema loading**: Use `schema` command when needed
- **JSON-only output**: stdout is reserved for JSON, logs go to stderr
- **Cross-platform first**: Uses Deno's std library for path handling
- **Connection pooling**: Reuses connections across commands

## Token Efficiency Comparison

**Scenario**: Multi-step development task across 6 tools from 3 servers

| Approach | Tokens Loaded | Tokens Used | Waste | Quality |
|----------|--------------|-------------|-------|---------|
| **Eager Loading** | 18,000 | 1,650 | 83% | Degraded |
| **MCP CLI** | 1,650 | 1,650 | 0% | Optimal |

**Savings**: 91% reduction in tool-related context pollution

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Resources

- [MCP Specification](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Documentation](./docs/)
- [Examples](./docs/examples/)

## Support

- **Issues**: [GitHub Issues](https://github.com/cosmic/mcp-cli/issues)
- **Discussions**: [GitHub Discussions](https://github.com/cosmic/mcp-cli/discussions)

---

**Built with [Deno](https://deno.land) | Published to [JSR](https://jsr.io)**
