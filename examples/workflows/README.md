# Workflow Examples

This directory contains practical multi-step workflow examples using the MCP CLI.

## Overview

These examples demonstrate real-world use cases combining multiple MCP operations:

- **Browser automation** - Form filling, navigation, screenshots
- **File processing** - Reading, transforming, writing files
- **Cross-server workflows** - Operations spanning multiple servers
- **Error handling** - Retry logic, graceful degradation
- **Context management** - Chunked processing, streaming

## Quick Start

All examples are self-contained bash scripts. Make them executable and run:

```bash
chmod +x examples/workflows/*.sh
./examples/workflows/browser-automation.sh
```

## Examples

### 1. Browser Automation (`browser-automation.sh`)

Navigate to a website, fill a form, and take a screenshot.

**What it demonstrates**:

- Batch execution to maintain browser state
- Sequential browser operations
- Screenshot capture

**Usage**:

```bash
./browser-automation.sh
```

**Output**: Screenshot saved to `form-result.png`

---

### 2. File Processing Pipeline (`file-pipeline.sh`)

Read a configuration file, modify it, and write it back.

**What it demonstrates**:

- Cross-file operations
- JSON transformation with jq
- Version bumping

**Usage**:

```bash
./file-pipeline.sh config/app.json
```

**Output**: Updated configuration file with bumped version

---

### 3. Cross-Server Workflow (`cross-server.sh`)

Read a local file and create a GitHub issue from its contents.

**What it demonstrates**:

- Operations across multiple servers (filesystem → github)
- Data extraction and transformation
- Sequential workflow with dependencies

**Usage**:

```bash
./cross-server.sh templates/bug-report.md myorg/myrepo
```

**Output**: GitHub issue created, reference saved locally

---

### 4. Batch Processing (`batch-processing.sh`)

Process multiple JSON files with the same transformation.

**What it demonstrates**:

- Iterating over multiple files
- Parallel vs sequential processing
- Progress tracking

**Usage**:

```bash
./batch-processing.sh data/*.json
```

**Output**: Processed files in `processed/` directory

---

### 5. Error Handling (`error-handling.sh`)

Demonstrates retry logic and graceful degradation.

**What it demonstrates**:

- Exponential backoff retry
- Fallback to alternative tools
- Transactional batch execution

**Usage**:

```bash
./error-handling.sh
```

**Output**: Resilient execution with automatic recovery

---

## Workflow Patterns

### Pattern 1: Stateful Batch

When operations share state (e.g., browser session):

```bash
mcp tools batch playwright --operations '[
  {"tool":"browser_navigate","args":{"url":"..."}},
  {"tool":"browser_click","args":{"selector":"..."}},
  {"tool":"browser_screenshot","args":{"filename":"..."}}
]'
```

**Benefits**:

- ✅ Connection stays open
- ✅ State maintained
- ✅ Faster execution

### Pattern 2: Sequential Cross-Server

When operations span multiple servers:

```bash
# Step 1: Get data from server A
DATA=$(mcp tools exec serverA get_data --args '{}')

# Step 2: Process and send to server B
mcp tools exec serverB process --args "{\"data\":\"$DATA\"}"
```

**Benefits**:

- ✅ Works across servers
- ✅ Can transform data between steps
- ✅ Independent retry logic

### Pattern 3: Parallel Independent

When operations are completely independent:

```bash
mcp tools exec filesystem read_file --args '{"path":"file1.txt"}' &
mcp tools exec filesystem read_file --args '{"path":"file2.txt"}' &
mcp tools exec filesystem read_file --args '{"path":"file3.txt"}' &
wait
```

**Benefits**:

- ✅ Fastest execution
- ✅ No dependencies
- ✅ Simple error handling

## Best Practices

### 1. Use Batch for Stateful Operations

```bash
# ✅ Good: Batch maintains browser state
mcp tools batch playwright --operations '[...]'

# ❌ Bad: Separate calls lose state
mcp tools exec playwright browser_navigate --args '{...}'
mcp tools exec playwright browser_screenshot --args '{...}'  # New browser!
```

### 2. Check for Errors

```bash
RESULT=$(mcp tools exec ...)

if ! echo "$RESULT" | jq -e '.success' >/dev/null; then
  echo "Error: $(echo "$RESULT" | jq -r '.error.message')"
  exit 1
fi
```

### 3. Use Progressive Disclosure

```bash
# Step 1: Discover (minimal tokens)
DISCOVERY=$(mcp discover "task description")

# Step 2: Load schemas (only for selected tools)
SCHEMAS=$(mcp tools schema server tool1 tool2)

# Step 3: Execute
RESULT=$(mcp tools exec server tool1 --args '{...}')
```

### 4. Manage Context with Token Limits

```bash
# Limit large responses
mcp tools exec filesystem read_file \
  --args '{"path":"large.log"}' \
  --max-tokens 500
```

### 5. Use Transactional Batches for Atomic Operations

```bash
# All or nothing
mcp tools batch database --transactional --operations '[
  {"tool":"begin_transaction","args":{}},
  {"tool":"insert_record","args":{...}},
  {"tool":"commit_transaction","args":{}}
]'
```

## Testing Workflows

Each workflow includes example usage and expected output. To test:

```bash
# Run all workflows
for script in examples/workflows/*.sh; do
  echo "Testing $script..."
  "$script" || echo "FAILED: $script"
done
```

## Combining with Agents

These workflows can be integrated into agents:

```typescript
// In your agent
const browserWorkflow = new WorkflowRunner("./examples/workflows/browser-automation.sh");
const result = await browserWorkflow.execute();
```

## Token Usage Comparison

| Workflow           | Eager Loading  | Progressive Disclosure | Savings |
| ------------------ | -------------- | ---------------------- | ------- |
| Browser Automation | ~12,000 tokens | ~800 tokens            | 93%     |
| File Pipeline      | ~8,000 tokens  | ~600 tokens            | 92%     |
| Cross-Server       | ~15,000 tokens | ~1,200 tokens          | 92%     |

## Further Reading

- [WORKFLOWS.md](../../docs/WORKFLOWS.md) - Detailed workflow patterns
- [AGENT_INTEGRATION.md](../../docs/AGENT_INTEGRATION.md) - Agent integration guide
- [API_REFERENCE.md](../../docs/API_REFERENCE.md) - Command reference

## Contributing

Have a useful workflow? Share it!

1. Create a new script: `<workflow-name>.sh`
2. Follow the pattern above (discovery → schema → execution)
3. Add usage examples
4. Update this README
5. Submit a PR

## Support

Questions? Issues?

- File an issue: https://github.com/your-org/mcp-cli/issues
- Read the docs: [Main README](../../README.md)
