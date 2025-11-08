# Getting Started with MCP CLI Bridge

This guide will help you get started with the MCP CLI Bridge.

## Prerequisites

- Node.js 18 or higher
- An MCP server to connect to (e.g., `@modelcontextprotocol/server-filesystem`)

## Installation

Install the CLI globally:

```bash
npm install -g @codesinabox/mcp-cli
```

Or use it directly with npx (no installation required):

```bash
npx @codesinabox/mcp-cli --help
```

## Basic Workflow

### Step 1: Add Your First Server

Let's add a filesystem MCP server:

```bash
mcp-cli servers add myfiles \
  --type stdio \
  --command npx \
  --args '["@modelcontextprotocol/server-filesystem", "/home/user/projects"]'
```

This adds a server named "myfiles" that provides access to the `/home/user/projects` directory.

### Step 2: Test the Connection

Verify that the server is working:

```bash
mcp-cli servers test myfiles
```

You should see a success message with information about the connection.

### Step 3: Explore Available Tools

List all tools provided by the server:

```bash
mcp-cli tools list myfiles
```

This will show you all available tools, their descriptions, and input schemas.

### Step 4: Execute a Tool

Let's read a file:

```bash
mcp-cli tools exec myfiles read_file \
  --args '{"path": "/home/user/projects/README.md"}'
```

The output will be in JSON format with the file contents.

## Working with Different MCP Servers

### Filesystem Server

```bash
# Add server
mcp-cli servers add files \
  --type stdio \
  --command npx \
  --args '["@modelcontextprotocol/server-filesystem", "/path/to/directory"]'

# Read a file
mcp-cli tools exec files read_file \
  --args '{"path": "/path/to/file.txt"}'

# List directory
mcp-cli tools exec files list_directory \
  --args '{"path": "/path/to/directory"}'

# Search files
mcp-cli tools exec files search_files \
  --args '{"path": "/path/to/directory", "pattern": "*.ts"}'
```

### GitHub Server (SSE - When Implemented)

```bash
# Add GitHub server
mcp-cli servers add github \
  --type sse \
  --url "http://localhost:3000/sse" \
  --api-key "${GITHUB_TOKEN}"

# List tools
mcp-cli tools list github
```

## Using with Claude

When using MCP CLI Bridge with Claude through bash_tool, you can:

1. **Discover capabilities**:
```bash
mcp-cli tools list myfiles
```

2. **Execute operations**:
```bash
mcp-cli tools exec myfiles read_file --args '{"path": "/project/data.json"}'
```

3. **Parse responses**: All outputs are JSON, so Claude can easily parse and use the results.

## Configuration File

The configuration is stored in `~/.mcp-cli/config.json`. You can edit this file directly if needed:

```json
{
  "servers": {
    "myfiles": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-filesystem",
        "/home/user/projects"
      ]
    }
  },
  "preferences": {
    "defaultTimeout": 30000,
    "maxRetries": 3,
    "logLevel": "info"
  }
}
```

## Using Environment Variables

For security, you can use environment variables in your configuration:

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

Set the environment variable before running:

```bash
export GITHUB_TOKEN="your-token-here"
mcp-cli tools list github
```

## Troubleshooting

### Server won't connect

1. Check that the server command is correct
2. Verify the server is installed: `npm list -g @modelcontextprotocol/server-filesystem`
3. Test the server manually
4. Check logs with verbose flag: `mcp-cli -v servers test myfiles`

### Tool execution fails

1. Verify the tool name: `mcp-cli tools list <server>`
2. Check the tool schema: `mcp-cli tools schema <server> <tool>`
3. Ensure your arguments match the schema
4. Use verbose logging: `mcp-cli -v tools exec ...`

### JSON parsing errors

Make sure to properly quote JSON strings:

```bash
# Correct
mcp-cli tools exec myfiles read_file --args '{"path": "/file.txt"}'

# Incorrect
mcp-cli tools exec myfiles read_file --args {"path": "/file.txt"}
```

## Next Steps

- Read the [API Documentation](./API.md) for detailed command reference
- Explore MCP server implementations at [MCP Servers](https://github.com/modelcontextprotocol/servers)
- Join the MCP community for support and updates

## Common Use Cases

### 1. File Management

```bash
# Read file
mcp-cli tools exec files read_file --args '{"path": "/file.txt"}'

# Write file
mcp-cli tools exec files write_file --args '{"path": "/file.txt", "content": "Hello"}'

# List directory
mcp-cli tools exec files list_directory --args '{"path": "/"}'
```

### 2. Code Search

```bash
# Search for files
mcp-cli tools exec files search_files --args '{"path": "/project", "pattern": "*.ts"}'
```

### 3. Working with Resources

```bash
# List resources
mcp-cli resources list files

# Read resource
mcp-cli resources read files "file:///project/data.json"
```

## Best Practices

1. **Use descriptive server names**: Choose names that clearly indicate the server's purpose
2. **Test connections**: Always test new servers with `mcp-cli servers test <name>`
3. **Check schemas**: Use `mcp-cli tools schema` to understand tool parameters
4. **Handle errors**: Parse the JSON output and check the `success` field
5. **Secure credentials**: Use environment variables for API keys and tokens
6. **Log appropriately**: Use `-v` for debugging, `-q` for production

## Getting Help

- Run `mcp-cli --help` for command overview
- Run `mcp-cli <command> --help` for command-specific help
- Check the [README](../README.md) for more examples
- Visit [MCP Documentation](https://modelcontextprotocol.io) for protocol details
