# Agent Examples

This directory contains example implementations of AI agents that integrate with the MCP CLI.

## Overview

These examples demonstrate the recommended agent workflow:

1. **Discovery**: Use `discover` command to find relevant servers and tools
2. **Schema Loading**: Use `tools schema` to get just-in-time schemas for selected tools
3. **Execution**: Use `tools exec` or `tools batch` to execute tools

## Examples

### TypeScript Agent (`typescript-agent.ts`)

A comprehensive TypeScript agent implementation with:

- Structured MCP command execution
- Progressive disclosure workflow
- Error handling and retries
- Type-safe interfaces

**Use case**: Production-ready agent in TypeScript/Node.js environments

### Python Agent (`python-agent.py`)

A Python implementation showing:

- Subprocess-based MCP CLI integration
- JSON response parsing
- Context-aware decision making

**Use case**: Python-based AI applications and scripts

### Bash Agent (`bash-agent.sh`)

A shell script demonstrating:

- Minimal dependencies (just bash + jq)
- Pipeline-based workflow
- Quick prototyping

**Use case**: Shell automation, CI/CD pipelines

## Quick Start

### TypeScript Agent

```bash
# Install dependencies
npm install

# Run the agent
deno run --allow-all typescript-agent.ts "automate browser navigation and screenshot"
```

### Python Agent

```bash
# Install dependencies
pip install -r requirements.txt

# Run the agent
python python-agent.py "automate browser navigation and screenshot"
```

### Bash Agent

```bash
# Make executable
chmod +x bash-agent.sh

# Run the agent
./bash-agent.sh "automate browser navigation and screenshot"
```

## Agent Workflow Pattern

All examples follow this pattern:

```
1. DISCOVER
   ↓
   User provides task description
   ↓
   `mcp discover "<task>"`
   ↓
   Get: servers, matches, suggested_batch

2. LOAD SCHEMAS (if needed)
   ↓
   For selected tools
   ↓
   `mcp tools schema <server> <tool1> <tool2> ...`
   ↓
   Get: Full tool schemas with argument definitions

3. EXECUTE
   ↓
   Single tool: `mcp tools exec <server> <tool> --args '...'`
   OR
   Batch: `mcp tools batch <server> --operations '[...]'`
   ↓
   Get: Tool execution results
```

## Token Optimization

All examples demonstrate progressive disclosure:

- **Discovery**: ~300-500 tokens (server list + top matches)
- **Schema Loading**: ~200-400 tokens per tool (only when needed)
- **Execution**: Variable based on results

Compare to eager loading (all tools + schemas): 10,000+ tokens

**Token Savings**: 91-99% reduction

## Integration Patterns

### Pattern 1: Streaming Agent

Agent processes user requests in real-time, maintaining conversation context:

```typescript
while (true) {
  const userMessage = await getUserInput();
  const response = await agent.process(userMessage);
  await sendResponse(response);
}
```

See: `typescript-agent.ts`

### Pattern 2: Task Runner

Agent executes a single task and exits:

```python
task = sys.argv[1]
result = agent.execute_task(task)
print(result)
```

See: `python-agent.py`

### Pattern 3: Daemon/Service

Agent runs as a background service, processing requests from a queue:

```bash
while read -r task; do
  process_task "$task"
done < /tmp/task-queue
```

See: `bash-agent.sh` (with modifications)

## Best Practices

### 1. Always Start with Discovery

```typescript
// ✅ Good: Use discover to find tools
const discovery = await agent.discover("take a screenshot");

// ❌ Bad: Hardcode tool names
const result = await agent.exec("playwright", "browser_screenshot", {...});
```

### 2. Load Schemas Just-In-Time

```typescript
// ✅ Good: Load schemas only when needed
const schemas = await agent.loadSchemas(server, selectedTools);

// ❌ Bad: Load all schemas upfront
const allSchemas = await agent.loadSchemas(server, allTools);
```

### 3. Use Batch for Related Operations

```typescript
// ✅ Good: Batch browser operations
await agent.batch("playwright", [
  { tool: "browser_navigate", args: { url: "..." } },
  { tool: "browser_screenshot", args: { filename: "..." } },
]);

// ❌ Bad: Multiple separate executions (loses state)
await agent.exec("playwright", "browser_navigate", { url: "..." });
await agent.exec("playwright", "browser_screenshot", { filename: "..." });
```

### 4. Handle Errors Gracefully

```typescript
try {
  const result = await agent.exec(...);
} catch (error) {
  if (error.code === "TOOL_NOT_FOUND") {
    // Re-discover or suggest alternatives
    const alternatives = await agent.discover(task);
  }
}
```

## Testing Your Agent

Each example includes basic tests. To run:

```bash
# TypeScript
deno test typescript-agent.test.ts

# Python
pytest python-agent-test.py

# Bash
./bash-agent-test.sh
```

## Further Reading

- [Agent Integration Guide](../../docs/AGENT_INTEGRATION.md) - Complete integration patterns
- [API Reference](../../docs/API_REFERENCE.md) - Command documentation
- [Workflows](../../docs/WORKFLOWS.md) - Multi-step workflow examples

## Contributing

Have a better agent implementation? We'd love to see it!

1. Create a new file: `<language>-agent.<ext>`
2. Follow the workflow pattern above
3. Add tests
4. Update this README
5. Submit a PR

## Support

Questions? Issues?

- File an issue: https://github.com/your-org/mcp-cli/issues
- Read the docs: [Main README](../../README.md)
