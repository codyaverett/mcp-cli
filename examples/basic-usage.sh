#!/bin/bash

# MCP CLI Bridge - Basic Usage Examples

echo "=== MCP CLI Bridge Examples ==="
echo ""

# 1. Add a filesystem server
echo "1. Adding a filesystem server..."
mcp-cli servers add myfiles \
  --type stdio \
  --command npx \
  --args '["@modelcontextprotocol/server-filesystem", "/tmp"]'

echo ""

# 2. List configured servers
echo "2. Listing configured servers..."
mcp-cli servers list

echo ""

# 3. Test the server connection
echo "3. Testing server connection..."
mcp-cli servers test myfiles

echo ""

# 4. List available tools
echo "4. Listing available tools..."
mcp-cli tools list myfiles

echo ""

# 5. Get schema for a specific tool
echo "5. Getting schema for read_file tool..."
mcp-cli tools schema myfiles read_file

echo ""

# 6. Execute a tool (example - adjust path as needed)
echo "6. Executing list_directory tool..."
mcp-cli tools exec myfiles list_directory \
  --args '{"path": "/tmp"}'

echo ""

# 7. List resources
echo "7. Listing resources..."
mcp-cli resources list myfiles

echo ""

# 8. Remove the server
echo "8. Removing server..."
mcp-cli servers remove myfiles

echo ""
echo "=== Examples Complete ==="
