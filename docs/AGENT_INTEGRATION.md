# Agent Integration Guide

This guide shows AI agents and developers how to integrate with the MCP CLI to discover and execute tools efficiently using progressive disclosure.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Agent Workflow Overview](#agent-workflow-overview)
3. [Progressive Disclosure Strategy](#progressive-disclosure-strategy)
4. [Discovery Methods](#discovery-methods)
5. [Batch Execution](#batch-execution)
6. [Integration Patterns](#integration-patterns)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Quick Start

### Minimal Agent Workflow (3 Commands)

```bash
# 1. Discover relevant tools for a task
mcp discover "navigate to a webpage and take a screenshot"

# 2. Load schemas for the tools you need
mcp tools schema playwright browser_navigate browser_screenshot

# 3. Execute tools (use batch for stateful operations)
mcp tools batch playwright --operations '[
  {"tool":"browser_navigate","args":{"url":"https://example.com"}},
  {"tool":"browser_screenshot","args":{"filename":"page.png"}}
]'
```

**Result**: Navigate to a webpage and capture a screenshot while maintaining browser session state.

## Agent Workflow Overview

### The Three-Phase Approach

AI agents should follow this three-phase workflow to minimize context usage while maintaining discoverability:

```
┌─────────────┐
│  Phase 1:   │  Discovery (50-100 tokens)
│  Discovery  │  ├─ List servers
│             │  ├─ Search for relevant tools
└──────┬──────┘  └─ Get recommendations
       │
       ▼
┌─────────────┐
│  Phase 2:   │  Schema Loading (200-400 tokens)
│  Schema     │  ├─ Load only needed tool schemas
│  Loading    │  └─ Understand required arguments
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Phase 3:   │  Execution
│  Execution  │  ├─ Execute single tools
│             │  └─ Batch related operations
└─────────────┘
```

### Token Efficiency Comparison

| Approach                                      | Tokens Used | Reduction     |
| --------------------------------------------- | ----------- | ------------- |
| **Eager Loading** (load all schemas upfront)  | 10,000+     | 0% (baseline) |
| **Progressive Disclosure** (MCP CLI approach) | 350-1,000   | 91-99%        |

**Example Breakdown for Progressive Disclosure**:

- Phase 1 (Discovery): 50-100 tokens
- Phase 2 (Schema Loading): 200-400 tokens
- Phase 3 (Execution): Variable (depends on results)
- **Total**: ~350-1,000 tokens for typical workflows

## Progressive Disclosure Strategy

### Understanding Context Levels

The MCP CLI provides three levels of detail for tool information:

#### Level 1: Names Only (~100 tokens)

```bash
mcp tools list playwright --names-only
```

**Output:**

```json
{
  "success": true,
  "data": [
    "browser_navigate",
    "browser_screenshot",
    "browser_click",
    "browser_fill"
  ],
  "metadata": {
    "server": "playwright",
    "tokensEstimate": 100,
    "resultSize": "small"
  }
}
```

**When to use**: Browsing available tools without commitment.

#### Level 2: Brief Mode (~500 tokens)

```bash
mcp tools list playwright --brief
```

**Output:**

```json
{
  "success": true,
  "data": [
    {
      "name": "browser_navigate",
      "description": "Navigate browser to a specified URL"
    },
    {
      "name": "browser_screenshot",
      "description": "Capture a screenshot of the current page"
    }
  ],
  "metadata": {
    "tokensEstimate": 500,
    "resultSize": "medium"
  }
}
```

**When to use**: Understanding what tools do before loading full schemas.

#### Level 3: Full Schema (~2,000+ tokens)

```bash
mcp tools schema playwright browser_navigate browser_screenshot
```

**Output:**

```json
{
  "success": true,
  "data": [
    {
      "name": "browser_navigate",
      "description": "Navigate browser to a specified URL",
      "inputSchema": {
        "type": "object",
        "properties": {
          "url": {
            "type": "string",
            "description": "The URL to navigate to"
          },
          "waitUntil": {
            "type": "string",
            "enum": ["load", "domcontentloaded", "networkidle"],
            "description": "Wait until this event before returning"
          }
        },
        "required": ["url"]
      }
    }
  ],
  "metadata": {
    "tokensEstimate": 400,
    "resultSize": "medium"
  }
}
```

**When to use**: Just before executing a tool (just-in-time loading).

## Discovery Methods

### Method 1: Unified Discovery (Recommended)

The `discover` command provides intelligent discovery based on task description:

```bash
mcp discover "read configuration files and create GitHub issues"
```

**Output:**

```json
{
  "success": true,
  "data": {
    "servers": [
      { "name": "filesystem", "tools": 15, "enabled": true },
      { "name": "github", "tools": 12, "enabled": true }
    ],
    "matches": [
      {
        "server": "filesystem",
        "tool": "read_file",
        "description": "Read contents of a file",
        "confidence": 0.92
      },
      {
        "server": "github",
        "tool": "create_issue",
        "description": "Create a new issue in a repository",
        "confidence": 0.88
      }
    ],
    "suggested_batch": null
  }
}
```

**Advantages**:

- Single command for discovery
- Confidence scores help prioritize
- Identifies relevant servers automatically

### Method 2: Search Across Servers

Search for specific keywords across all configured servers:

```bash
mcp search "screenshot" --detailed
```

**Output:**

```json
{
  "success": true,
  "data": {
    "playwright": [
      { "name": "browser_screenshot", "description": "Capture a screenshot" }
    ],
    "desktop": [
      { "name": "capture_screen", "description": "Capture desktop screenshot" }
    ]
  }
}
```

**When to use**: When you know what you're looking for but not which server provides it.

### Method 3: Server-Specific Browsing

List tools from a specific server when you know which server to use:

```bash
# Quick browse - names only
mcp tools list filesystem --names-only

# With descriptions
mcp tools list filesystem --brief
```

**When to use**: When you already know which server has the capabilities you need.

### Method 4: Recommendations

Get AI-powered recommendations for a natural language task:

```bash
mcp recommend "I need to search for files in a directory"
```

**Output:**

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
        "server": "filesystem",
        "tool": "list_directory",
        "description": "List directory contents",
        "confidence": 0.42
      }
    ]
  }
}
```

**When to use**: For task-based discovery when you want the system to suggest the best tools.

## Batch Execution

### When to Batch Operations

Use batch execution when operations meet ALL of these criteria:

1. **Same server**: All operations target the same MCP server
2. **Sequential dependency**: Operations must run in order
3. **Stateful**: Operations share state (e.g., browser session, database connection)
4. **Related**: Operations are part of a single logical workflow

### Batch vs Sequential Execution

| Scenario                                     | Approach       | Reason                            |
| -------------------------------------------- | -------------- | --------------------------------- |
| Navigate → Screenshot (browser)              | **Batch**      | Shares browser session            |
| Read file → Create issue (different servers) | **Sequential** | Different servers can't batch     |
| Independent file operations                  | **Sequential** | No state dependency               |
| Database transaction steps                   | **Batch**      | Shares connection + transactional |

### Batch Execution Example

```bash
mcp tools batch playwright --operations '[
  {"tool":"browser_navigate","args":{"url":"https://github.com"}},
  {"tool":"browser_click","args":{"selector":"#login-button"}},
  {"tool":"browser_fill","args":{"selector":"#username","value":"user"}},
  {"tool":"browser_screenshot","args":{"filename":"login-page.png"}}
]'
```

**Output:**

```json
{
  "success": true,
  "data": {
    "operations": [
      {
        "tool": "browser_navigate",
        "result": { "content": [{ "type": "text", "text": "Navigated to https://github.com" }] },
        "executionTime": 1234
      },
      {
        "tool": "browser_click",
        "result": { "content": [{ "type": "text", "text": "Clicked #login-button" }] },
        "executionTime": 456
      }
    ],
    "summary": {
      "total": 4,
      "succeeded": 4,
      "failed": 0
    }
  },
  "metadata": {
    "server": "playwright",
    "executionTime": 3456
  }
}
```

### Transactional Mode

Use `--transactional` to fail the entire batch if any operation fails:

```bash
mcp tools batch database --transactional --operations '[
  {"tool":"begin_transaction","args":{}},
  {"tool":"update_record","args":{"id":1,"data":"..."}},
  {"tool":"update_record","args":{"id":2,"data":"..."}},
  {"tool":"commit_transaction","args":{}}
]'
```

**Behavior**:

- Without `--transactional`: Continues on errors, returns partial results
- With `--transactional`: Stops on first error, exits with error code 1

## Integration Patterns

### Pattern 1: Claude Integration (TypeScript)

```typescript
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface MCPResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    suggestion?: string;
  };
  metadata?: {
    server?: string;
    tokensEstimate?: number;
    executionTime?: number;
  };
}

class MCPAgent {
  private mcpPath: string;

  constructor(mcpPath = "mcp") {
    this.mcpPath = mcpPath;
  }

  /**
   * Execute MCP command and parse JSON response
   */
  private async execMCP<T>(command: string): Promise<MCPResponse<T>> {
    const { stdout, stderr } = await execAsync(`${this.mcpPath} ${command}`);

    if (stderr) {
      console.error("MCP stderr:", stderr);
    }

    return JSON.parse(stdout) as MCPResponse<T>;
  }

  /**
   * Discover tools for a task
   */
  async discover(task: string): Promise<MCPResponse> {
    return this.execMCP(`discover "${task}"`);
  }

  /**
   * Load tool schemas
   */
  async loadSchemas(server: string, tools: string[]): Promise<MCPResponse> {
    const toolList = tools.join(" ");
    return this.execMCP(`tools schema ${server} ${toolList}`);
  }

  /**
   * Execute a single tool
   */
  async executeTool(
    server: string,
    tool: string,
    args: Record<string, unknown>,
  ): Promise<MCPResponse> {
    const argsJSON = JSON.stringify(args).replace(/"/g, '\\"');
    return this.execMCP(`tools exec ${server} ${tool} --args "${argsJSON}"`);
  }

  /**
   * Execute batch of operations
   */
  async executeBatch(
    server: string,
    operations: Array<{ tool: string; args: Record<string, unknown> }>,
    transactional = false,
  ): Promise<MCPResponse> {
    const opsJSON = JSON.stringify(operations).replace(/"/g, '\\"');
    const txFlag = transactional ? "--transactional" : "";
    return this.execMCP(`tools batch ${server} ${txFlag} --operations "${opsJSON}"`);
  }
}

// Usage example
async function main() {
  const agent = new MCPAgent();

  // 1. Discover tools
  const discovery = await agent.discover("navigate to a webpage and screenshot");
  console.log("Discovered tools:", discovery.data);

  // 2. Load schemas for relevant tools
  const schemas = await agent.loadSchemas("playwright", [
    "browser_navigate",
    "browser_screenshot",
  ]);
  console.log("Tool schemas:", schemas.data);

  // 3. Execute batch operation
  const result = await agent.executeBatch("playwright", [
    { tool: "browser_navigate", args: { url: "https://example.com" } },
    { tool: "browser_screenshot", args: { filename: "page.png", fullPage: true } },
  ]);

  console.log("Execution result:", result.data);
}

main().catch(console.error);
```

### Pattern 2: Python Integration

```python
import subprocess
import json
from typing import Dict, List, Any, Optional

class MCPAgent:
    def __init__(self, mcp_path: str = "mcp"):
        self.mcp_path = mcp_path

    def _exec_mcp(self, command: str) -> Dict[str, Any]:
        """Execute MCP command and parse JSON response"""
        full_command = f"{self.mcp_path} {command}"
        result = subprocess.run(
            full_command,
            shell=True,
            capture_output=True,
            text=True
        )

        if result.stderr:
            print(f"MCP stderr: {result.stderr}", file=sys.stderr)

        return json.loads(result.stdout)

    def discover(self, task: str) -> Dict[str, Any]:
        """Discover tools for a task"""
        return self._exec_mcp(f'discover "{task}"')

    def load_schemas(self, server: str, tools: List[str]) -> Dict[str, Any]:
        """Load tool schemas"""
        tool_list = " ".join(tools)
        return self._exec_mcp(f"tools schema {server} {tool_list}")

    def execute_tool(
        self,
        server: str,
        tool: str,
        args: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a single tool"""
        args_json = json.dumps(args)
        return self._exec_mcp(f'tools exec {server} {tool} --args \'{args_json}\'')

    def execute_batch(
        self,
        server: str,
        operations: List[Dict[str, Any]],
        transactional: bool = False
    ) -> Dict[str, Any]:
        """Execute batch of operations"""
        ops_json = json.dumps(operations)
        tx_flag = "--transactional" if transactional else ""
        return self._exec_mcp(
            f'tools batch {server} {tx_flag} --operations \'{ops_json}\''
        )

# Usage example
def main():
    agent = MCPAgent()

    # 1. Discover tools
    discovery = agent.discover("navigate to a webpage and screenshot")
    print("Discovered tools:", discovery["data"])

    # 2. Load schemas
    schemas = agent.load_schemas("playwright", [
        "browser_navigate",
        "browser_screenshot"
    ])
    print("Tool schemas:", schemas["data"])

    # 3. Execute batch
    result = agent.execute_batch("playwright", [
        {"tool": "browser_navigate", "args": {"url": "https://example.com"}},
        {"tool": "browser_screenshot", "args": {"filename": "page.png", "fullPage": True}}
    ])

    print("Execution result:", result["data"])

if __name__ == "__main__":
    main()
```

### Pattern 3: Bash Integration

```bash
#!/bin/bash

# MCP Agent - Simple bash wrapper for MCP CLI

MCP_PATH="mcp"

# Execute MCP command and parse response
mcp_exec() {
    local command="$1"
    $MCP_PATH $command 2>/dev/null | jq '.'
}

# Discover tools for a task
mcp_discover() {
    local task="$1"
    mcp_exec "discover \"$task\""
}

# Load tool schemas
mcp_load_schemas() {
    local server="$1"
    shift
    local tools="$@"
    mcp_exec "tools schema $server $tools"
}

# Execute single tool
mcp_execute_tool() {
    local server="$1"
    local tool="$2"
    local args="$3"
    mcp_exec "tools exec $server $tool --args '$args'"
}

# Execute batch operations
mcp_execute_batch() {
    local server="$1"
    local operations="$2"
    local transactional="${3:-}"

    if [ -n "$transactional" ]; then
        mcp_exec "tools batch $server --transactional --operations '$operations'"
    else
        mcp_exec "tools batch $server --operations '$operations'"
    fi
}

# Example usage
main() {
    echo "=== Discovering tools ==="
    mcp_discover "navigate to webpage and screenshot"

    echo -e "\n=== Loading schemas ==="
    mcp_load_schemas "playwright" "browser_navigate" "browser_screenshot"

    echo -e "\n=== Executing batch ==="
    local operations='[
        {"tool":"browser_navigate","args":{"url":"https://example.com"}},
        {"tool":"browser_screenshot","args":{"filename":"page.png","fullPage":true}}
    ]'
    mcp_execute_batch "playwright" "$operations"
}

main
```

## Best Practices

### 1. Progressive Disclosure

**DO**: Start minimal and load details as needed

```bash
# Good: Discover → Load schemas → Execute
mcp discover "task description"
mcp tools schema server tool1 tool2
mcp tools exec server tool1 --args '{...}'
```

**DON'T**: Load all schemas upfront

```bash
# Bad: Wastes context loading unnecessary schemas
mcp tools list server1 --full
mcp tools list server2 --full
mcp tools list server3 --full
```

### 2. Batching Strategy

**DO**: Batch stateful operations on the same server

```bash
# Good: Browser operations maintain session
mcp tools batch playwright --operations '[...]'
```

**DON'T**: Batch independent operations or different servers

```bash
# Bad: These are independent, execute separately
mcp tools batch filesystem --operations '[
  {"tool":"read_file","args":{"path":"a.txt"}},
  {"tool":"read_file","args":{"path":"b.txt"}}
]'
```

### 3. Error Handling

**DO**: Check success field and handle errors gracefully

```typescript
const result = await execMCP("tools exec ...");
if (!result.success) {
  console.error(`Error: ${result.error?.message}`);
  console.log(`Suggestion: ${result.error?.suggestion}`);
  return;
}
```

**DON'T**: Assume operations always succeed

```typescript
// Bad: No error checking
const result = await execMCP("tools exec ...");
processResult(result.data); // Might be undefined!
```

### 4. Context Management

**DO**: Use `--max-tokens` to limit large responses

```bash
mcp tools exec filesystem read_file --args '{"path":"large.txt"}' --max-tokens 500
```

**DON'T**: Load unlimited data into context

```bash
# Bad: Might return megabytes of data
mcp tools exec filesystem read_file --args '{"path":"huge.log"}'
```

### 5. Discovery Efficiency

**DO**: Use discover or recommend for task-based discovery

```bash
# Good: Let the system find relevant tools
mcp discover "create GitHub issue from file"
```

**DON'T**: Manually search through all servers

```bash
# Bad: Wastes time and context
mcp tools list server1 --brief
mcp tools list server2 --brief
mcp tools list server3 --brief
```

## Troubleshooting

### Common Issues

#### 1. "Server not found" Error

```json
{
  "success": false,
  "error": {
    "code": "SERVER_NOT_FOUND",
    "message": "Server 'myserver' not found in configuration",
    "suggestion": "Available servers: filesystem, github"
  }
}
```

**Solution**: List configured servers:

```bash
mcp servers list --names-only
```

#### 2. "Tool not found" Error

```json
{
  "success": false,
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "Tool 'invalid_tool' not found on server 'playwright'",
    "similar": ["browser_navigate", "browser_screenshot"]
  }
}
```

**Solution**: Use discover or list tools:

```bash
mcp tools list playwright --names-only
```

#### 3. Batch Operation Fails Midway

**With transactional mode**:

- Entire batch fails
- Exit code 1
- Partial results not returned

**Without transactional mode**:

- Continues executing remaining operations
- Failed operations marked in results
- Exit code 0

**Example response**:

```json
{
  "success": true,
  "data": {
    "operations": [
      {"tool": "tool1", "result": {...}, "executionTime": 123},
      {"tool": "tool2", "result": {"error": {...}}, "executionTime": 45}
    ],
    "summary": {
      "total": 2,
      "succeeded": 1,
      "failed": 1
    }
  }
}
```

#### 4. Connection Timeout

```json
{
  "success": false,
  "error": {
    "code": "SERVER_TIMEOUT",
    "message": "Connection to server 'slow-server' timed out after 30000ms",
    "suggestion": "Try increasing the timeout in server configuration"
  }
}
```

**Solution**: Increase timeout in server config or check server health:

```bash
mcp servers test slow-server
```

## Next Steps

- **Workflow Examples**: See [WORKFLOWS.md](./WORKFLOWS.md) for multi-step scenarios
- **API Reference**: See [API_REFERENCE.md](./API_REFERENCE.md) for complete command documentation
- **Working Examples**: See [examples/agents/](../examples/agents/) for production-ready code

---

For more information, visit the [main README](../README.md) or [MCP CLI specification](./mcp-cli-bridge-spec.md).
