# Usage Examples

## Adding playwright-mcp

```shell
mcp servers add playwright --type stdio --command npx --args @playwright/mcp@latest
[2025-11-09T10:43:49.893Z] [INFO] Configuration loaded successfully
  {
    "path": "/Users/caavere/.mcp-cli/config.json",
    "servers": 0
  }
[2025-11-09T10:43:49.897Z] [INFO] Configuration saved successfully
  {
    "path": "/Users/caavere/.mcp-cli/config.json"
  }
{
  "success": true,
  "data": {
    "message": "Server 'playwright' added successfully",
    "name": "playwright",
    "type": "stdio"
  }
}
```

## Questions 

How will an Agent know what tools are available and use the mcp-cli-bridge?
How will it know
- the servers it should use
- the correct tools it needs from each server
- the arguments for each tools
- which tool executions to batch together

```markdown
  1. New executeBatch function in src/commands/tools.ts:270
    - Executes multiple tools sequentially while maintaining the connection
    - Supports transactional mode (fail entire batch on error) and non-transactional mode (continue on
  error)
    - Returns combined results with execution times and success/failure summary
    - Validates that all operations use the same server
  1. CLI command in src/cli.ts:214
    - New mcp tools batch <server> command
    - Takes --operations parameter with JSON array of operations
    - Optional --transactional flag for atomic execution
  2. Usage example:
  deno run --allow-all src/cli.ts tools batch playwright --operations '[
    {"tool":"browser_navigate","args":{"url":"https://google.com"}},
    {"tool":"browser_take_screenshot","args":{"filename":"google-batch.png","fullPage":true}}
  ]'
```
