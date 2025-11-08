# MCP CLI Bridge

A command-line tool that enables Claude (in enterprise environments) to interact with Model Context Protocol (MCP) servers through the `bash_tool`, effectively bypassing enterprise configuration restrictions while maintaining security and clean architecture patterns.

## Features

- **Multiple Transport Support**: Stdio, SSE, and HTTP transports (stdio fully implemented)
- **Simple CLI Interface**: Easy-to-use commands for all MCP operations
- **JSON I/O**: All output in JSON format for easy parsing
- **Configuration Management**: Store and manage multiple MCP server configurations
- **Secure**: Support for environment variable substitution in config

## Installation

```bash
npm install -g @codesinabox/mcp-cli
```

Or use directly with npx:

```bash
npx @codesinabox/mcp-cli --help
```

## Quick Start

### 1. Add an MCP Server

```bash
# Add a stdio-based filesystem server
mcp-cli servers add filesystem \
  --type stdio \
  --command npx \
  --args '["@modelcontextprotocol/server-filesystem", "/path/to/allowed/directory"]'
```

### 2. Test the Connection

```bash
mcp-cli servers test filesystem
```

### 3. List Available Tools

```bash
mcp-cli tools list filesystem
```

### 4. Execute a Tool

```bash
mcp-cli tools exec filesystem read_file \
  --args '{"path": "/path/to/file.txt"}'
```

## Usage

### Server Management

```bash
# List all configured servers
mcp-cli servers list

# Add a new server
mcp-cli servers add <name> --type <stdio|sse|http> [options]

# Remove a server
mcp-cli servers remove <name>

# Test server connection
mcp-cli servers test <name>
```

### Tool Operations

```bash
# List available tools
mcp-cli tools list <server-name>

# Get tool schema
mcp-cli tools schema <server-name> <tool-name>

# Execute a tool
mcp-cli tools exec <server-name> <tool-name> --args '{"param": "value"}'
```

### Resource Operations

```bash
# List resources
mcp-cli resources list <server-name>

# Read a resource
mcp-cli resources read <server-name> <resource-uri>
```

### Prompt Operations

```bash
# List prompts
mcp-cli prompts list <server-name>

# Get prompt
mcp-cli prompts get <server-name> <prompt-name> --args '{"var": "value"}'
```

## Configuration

Configuration is stored in `~/.mcp-cli/config.json`. You can also edit this file directly:

```json
{
  "servers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"],
      "env": {}
    },
    "github": {
      "type": "sse",
      "url": "http://localhost:3000/sse",
      "apiKey": "${GITHUB_TOKEN}"
    }
  },
  "preferences": {
    "defaultTimeout": 30000,
    "maxRetries": 3,
    "logLevel": "info"
  }
}
```

### Environment Variables

Use `${VAR_NAME}` syntax in configuration to substitute environment variables:

```json
{
  "servers": {
    "github": {
      "type": "sse",
      "url": "http://localhost:3000/sse",
      "apiKey": "${GITHUB_TOKEN}"
    }
  }
}
```

## Usage with Claude

Claude can use the MCP CLI Bridge through the bash_tool:

```typescript
// 1. List available tools
const toolsResult = await bash_tool({
  command: 'mcp-cli tools list filesystem'
});
// Parse JSON output to see available tools

// 2. Execute a tool
const execResult = await bash_tool({
  command: `mcp-cli tools exec filesystem read_file --args '{"path": "/project/README.md"}'`
});
// Parse JSON output to get file contents
```

## Output Format

All commands output JSON for easy parsing:

### Success Response

```json
{
  "success": true,
  "data": {
    // Command-specific data
  },
  "metadata": {
    "server": "server-name",
    "timestamp": "2025-11-08T12:00:00Z",
    "executionTime": 145
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
    "details": {}
  }
}
```

## Examples

### Example 1: Filesystem Operations

```bash
# Add filesystem server
mcp-cli servers add myfiles \
  --type stdio \
  --command npx \
  --args '["@modelcontextprotocol/server-filesystem", "/home/user/documents"]'

# List tools
mcp-cli tools list myfiles

# Read a file
mcp-cli tools exec myfiles read_file \
  --args '{"path": "/home/user/documents/README.md"}'

# List directory
mcp-cli tools exec myfiles list_directory \
  --args '{"path": "/home/user/documents"}'
```

### Example 2: Working with Resources

```bash
# List available resources
mcp-cli resources list myfiles

# Read a resource
mcp-cli resources read myfiles "file:///home/user/documents/data.json"
```

## Development

### Build from Source

```bash
# Clone the repository
git clone https://github.com/codesinabox/mcp-cli-bridge.git
cd mcp-cli-bridge

# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/index.js --help
```

### Run Tests

```bash
npm test
```

## Logging

The CLI logs to stderr (not stdout) to avoid polluting JSON output. Control log level with:

```bash
# Verbose logging
mcp-cli -v tools list filesystem

# Quiet mode (errors only)
mcp-cli -q tools list filesystem
```

Or set in configuration:

```json
{
  "preferences": {
    "logLevel": "debug"
  }
}
```

Log levels: `error`, `warn`, `info`, `debug`, `trace`

## Architecture

The MCP CLI Bridge consists of several layers:

1. **CLI Layer**: Commander.js-based interface
2. **Command Layer**: Command implementations for servers, tools, resources, and prompts
3. **Client Layer**: MCP client abstraction with transport-specific implementations
4. **Config Layer**: Configuration management with Zod validation
5. **Utils Layer**: Logging, JSON formatting, and error handling

## Supported Transports

- **Stdio** ✅ Fully implemented
- **SSE** 🚧 Planned
- **HTTP** 🚧 Planned

## Security Considerations

- Never logs or exposes credentials
- Supports environment variable substitution for secrets
- Validates all inputs against schemas
- Prevents command injection in stdio transports

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT

## Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Servers](https://github.com/modelcontextprotocol/servers)

## Support

For issues and questions:
- GitHub Issues: [https://github.com/codesinabox/mcp-cli-bridge/issues](https://github.com/codesinabox/mcp-cli-bridge/issues)
- MCP Documentation: [https://modelcontextprotocol.io](https://modelcontextprotocol.io)
