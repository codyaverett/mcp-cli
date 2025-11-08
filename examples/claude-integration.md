# Using MCP CLI Bridge with Claude

This guide shows how Claude can use the MCP CLI Bridge through bash_tool to interact with MCP servers.

## Setup

First, configure an MCP server:

```bash
mcp-cli servers add filesystem \
  --type stdio \
  --command npx \
  --args '["@modelcontextprotocol/server-filesystem", "/workspace"]'
```

## Example: File Reading Workflow

### 1. Discover Available Tools

```typescript
// Claude uses bash_tool
const toolsResponse = await bash_tool({
  command: 'mcp-cli tools list filesystem'
});

// Parse JSON response
const result = JSON.parse(toolsResponse);
// result.data.tools contains array of available tools
```

### 2. Check Tool Schema

```typescript
const schemaResponse = await bash_tool({
  command: 'mcp-cli tools schema filesystem read_file'
});

const schema = JSON.parse(schemaResponse);
// schema.data.tool.inputSchema describes parameters
```

### 3. Execute Tool

```typescript
const execResponse = await bash_tool({
  command: `mcp-cli tools exec filesystem read_file --args '{"path": "/workspace/README.md"}'`
});

const result = JSON.parse(execResponse);
if (result.success) {
  const fileContent = result.data.result;
  // Use file content...
}
```

## Example: File System Operations

### List Directory

```bash
mcp-cli tools exec filesystem list_directory \
  --args '{"path": "/workspace"}'
```

### Read File

```bash
mcp-cli tools exec filesystem read_file \
  --args '{"path": "/workspace/package.json"}'
```

### Search Files

```bash
mcp-cli tools exec filesystem search_files \
  --args '{"path": "/workspace", "pattern": "*.ts"}'
```

### Write File

```bash
mcp-cli tools exec filesystem write_file \
  --args '{"path": "/workspace/output.txt", "content": "Hello, World!"}'
```

## Error Handling

Always check the `success` field in responses:

```typescript
const response = await bash_tool({
  command: 'mcp-cli tools exec filesystem read_file --args \'{"path": "/nonexistent.txt"}\''
});

const result = JSON.parse(response);

if (!result.success) {
  console.error(`Error: ${result.error.message}`);
  console.error(`Code: ${result.error.code}`);
}
```

## Response Format

All responses follow this format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Command-specific data
  },
  "metadata": {
    "server": "filesystem",
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

## Best Practices

1. **Always parse JSON responses**: All output is JSON formatted
2. **Check success field**: Verify operation succeeded before using data
3. **Handle errors gracefully**: Use error codes to determine failure type
4. **Use appropriate tools**: Match tool to task (read_file vs list_directory)
5. **Validate parameters**: Check tool schema before execution

## Complete Workflow Example

```typescript
async function readProjectFiles(projectPath: string) {
  // 1. List directory
  const listResult = await bash_tool({
    command: `mcp-cli tools exec filesystem list_directory --args '{"path": "${projectPath}"}'`
  });

  const files = JSON.parse(listResult);
  if (!files.success) {
    throw new Error(`Failed to list directory: ${files.error.message}`);
  }

  // 2. Read each file
  const fileContents = {};
  for (const file of files.data.result) {
    if (file.type === 'file') {
      const readResult = await bash_tool({
        command: `mcp-cli tools exec filesystem read_file --args '{"path": "${file.path}"}'`
      });

      const content = JSON.parse(readResult);
      if (content.success) {
        fileContents[file.name] = content.data.result;
      }
    }
  }

  return fileContents;
}
```

## Working with Resources

Resources provide a different way to access data:

```bash
# List resources
mcp-cli resources list filesystem

# Read a specific resource
mcp-cli resources read filesystem "file:///workspace/config.json"
```

## Working with Prompts

Some MCP servers provide prompts:

```bash
# List available prompts
mcp-cli prompts list myserver

# Get a prompt with arguments
mcp-cli prompts get myserver review_code --args '{"language": "typescript"}'
```

## Tips for Claude

1. **Batch operations**: When reading multiple files, consider doing it in parallel
2. **Cache schemas**: Store tool schemas to avoid repeated lookups
3. **Validate paths**: Ensure file paths are within allowed directories
4. **Use metadata**: Execution time in metadata helps track performance
5. **Log errors**: Use stderr logging (visible via -v flag) for debugging
