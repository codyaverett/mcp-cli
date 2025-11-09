# Multi-Step Workflows

This guide demonstrates complex multi-step workflows using the MCP CLI, showing when to use batch execution, how to handle state, and how to chain operations across multiple servers.

## Table of Contents

1. [Workflow Patterns](#workflow-patterns)
2. [Browser Automation](#browser-automation)
3. [File Processing Pipeline](#file-processing-pipeline)
4. [Cross-Server Workflows](#cross-server-workflows)
5. [Error Recovery](#error-recovery)
6. [Context Management](#context-management)

## Workflow Patterns

### Pattern 1: Stateful Batch (Same Server)

**Use when**: Operations share state and target the same server

**Example**: Browser automation (session must persist)

```bash
mcp tools batch playwright --operations '[
  {"tool":"browser_navigate","args":{"url":"https://github.com"}},
  {"tool":"browser_click","args":{"selector":"#login"}},
  {"tool":"browser_fill","args":{"selector":"#username","value":"user"}},
  {"tool":"browser_screenshot","args":{"filename":"result.png"}}
]'
```

**Benefits**:

- ✅ Connection stays open
- ✅ State maintained (browser session)
- ✅ Faster execution (no reconnect overhead)
- ✅ Atomic operations with `--transactional`

### Pattern 2: Sequential Cross-Server

**Use when**: Operations span multiple servers

**Example**: Read file → Create GitHub issue

```bash
# Step 1: Read file from filesystem
CONTENT=$(mcp tools exec filesystem read_file \
  --args '{"path":"bug-report.md"}' | jq -r '.data.content[0].text')

# Step 2: Create GitHub issue with file content
mcp tools exec github create_issue \
  --args "{\"repo\":\"myorg/myrepo\",\"title\":\"Bug Report\",\"body\":\"$CONTENT\"}"
```

**Benefits**:

- ✅ Works across different servers
- ✅ Can transform data between steps
- ✅ Each step can be retried independently

### Pattern 3: Parallel Independent Operations

**Use when**: Operations are completely independent

**Example**: Multiple file reads that don't depend on each other

```bash
# Execute in parallel (background processes)
mcp tools exec filesystem read_file --args '{"path":"config1.json"}' &
mcp tools exec filesystem read_file --args '{"path":"config2.json"}' &
mcp tools exec filesystem read_file --args '{"path":"config3.json"}' &
wait

# Process results
```

**Benefits**:

- ✅ Fastest execution time
- ✅ No dependencies to manage
- ✅ Simple error handling (per-operation)

### Pattern 4: Conditional Execution

**Use when**: Later steps depend on earlier results

**Example**: Check if file exists → Read if exists → Process

```bash
#!/bin/bash

# Step 1: List directory
FILES=$(mcp tools exec filesystem list_directory --args '{"path":"/config"}')

# Step 2: Check if target file exists
if echo "$FILES" | jq -e '.data.files[] | select(.name=="app.json")' > /dev/null; then
  # Step 3: Read the file
  CONFIG=$(mcp tools exec filesystem read_file --args '{"path":"/config/app.json"}')

  # Step 4: Process config
  echo "$CONFIG" | jq '.data.content[0].text'
else
  echo "Config file not found"
fi
```

**Benefits**:

- ✅ Handles missing data gracefully
- ✅ Avoids unnecessary operations
- ✅ Clear error conditions

## Browser Automation

### Workflow: Form Submission with Validation

**Scenario**: Navigate to a form, fill it out, submit, and verify success

```bash
#!/bin/bash

echo "Starting form automation workflow..."

# Batch all browser operations to maintain session
RESULT=$(mcp tools batch playwright --operations '[
  {
    "tool": "browser_navigate",
    "args": {"url": "https://example.com/contact"}
  },
  {
    "tool": "browser_fill",
    "args": {
      "selector": "#name",
      "value": "John Doe"
    }
  },
  {
    "tool": "browser_fill",
    "args": {
      "selector": "#email",
      "value": "john@example.com"
    }
  },
  {
    "tool": "browser_fill",
    "args": {
      "selector": "#message",
      "value": "This is a test message"
    }
  },
  {
    "tool": "browser_click",
    "args": {"selector": "#submit-button"}
  },
  {
    "tool": "browser_screenshot",
    "args": {
      "filename": "submission-result.png",
      "fullPage": true
    }
  }
]')

# Check if all operations succeeded
SUCCEEDED=$(echo "$RESULT" | jq '.data.summary.succeeded')
TOTAL=$(echo "$RESULT" | jq '.data.summary.total')

if [ "$SUCCEEDED" -eq "$TOTAL" ]; then
  echo "✅ Form submitted successfully!"
  echo "Screenshot saved to submission-result.png"
else
  echo "❌ Some operations failed"
  echo "$RESULT" | jq '.data.operations[] | select(.result.error) | {tool, error: .result.error}'
fi
```

### Workflow: Multi-Page Data Extraction

**Scenario**: Navigate through multiple pages and extract data

```bash
#!/bin/bash

# Array to store extracted data
declare -a EXTRACTED_DATA

# Pages to scrape
PAGES=(
  "https://example.com/page1"
  "https://example.com/page2"
  "https://example.com/page3"
)

for PAGE in "${PAGES[@]}"; do
  echo "Processing $PAGE..."

  # Navigate and extract in a batch
  DATA=$(mcp tools batch playwright --operations "[
    {\"tool\":\"browser_navigate\",\"args\":{\"url\":\"$PAGE\"}},
    {\"tool\":\"browser_evaluate\",\"args\":{
      \"expression\":\"document.querySelector('.data-container').textContent\"
    }}
  ]")

  # Extract the result
  CONTENT=$(echo "$DATA" | jq -r '.data.operations[1].result.content[0].text')
  EXTRACTED_DATA+=("$CONTENT")

  echo "Extracted: $CONTENT"
done

# Combine all extracted data
printf '%s\n' "${EXTRACTED_DATA[@]}" > extracted_data.txt
echo "✅ Data extraction complete. Saved to extracted_data.txt"
```

## File Processing Pipeline

### Workflow: Read → Transform → Write

**Scenario**: Read configuration file, modify it, write back

```bash
#!/bin/bash

# Step 1: Read the config file
echo "Reading configuration..."
CONFIG=$(mcp tools exec filesystem read_file \
  --args '{"path":"config/app.json"}')

# Step 2: Extract and transform the data
CURRENT_VERSION=$(echo "$CONFIG" | jq -r '.data.content[0].text' | jq -r '.version')
NEW_VERSION=$(echo "$CURRENT_VERSION" | awk -F. '{$NF++;print}' OFS=.)

# Create updated config
UPDATED_CONFIG=$(echo "$CONFIG" | jq -r '.data.content[0].text' | \
  jq --arg ver "$NEW_VERSION" '.version = $ver')

# Step 3: Write the updated config back
echo "Writing updated configuration (version: $NEW_VERSION)..."
mcp tools exec filesystem write_file \
  --args "{\"path\":\"config/app.json\",\"content\":$(echo "$UPDATED_CONFIG" | jq -R -s '.')}"

echo "✅ Configuration updated from $CURRENT_VERSION to $NEW_VERSION"
```

### Workflow: Batch File Processing

**Scenario**: Process multiple files with the same transformation

```bash
#!/bin/bash

# Get list of JSON files
FILES=$(mcp tools exec filesystem list_directory \
  --args '{"path":"./data","pattern":"*.json"}')

# Extract file names
FILE_LIST=$(echo "$FILES" | jq -r '.data.files[].name')

# Process each file
echo "$FILE_LIST" | while read -r FILE; do
  echo "Processing $FILE..."

  # Read file
  CONTENT=$(mcp tools exec filesystem read_file \
    --args "{\"path\":\"./data/$FILE\"}")

  # Transform (example: add timestamp)
  TRANSFORMED=$(echo "$CONTENT" | jq -r '.data.content[0].text' | \
    jq --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '. + {processedAt: $ts}')

  # Write to processed directory
  mcp tools exec filesystem write_file \
    --args "{\"path\":\"./processed/$FILE\",\"content\":$(echo "$TRANSFORMED" | jq -R -s '.')}"

  echo "✅ Processed $FILE"
done

echo "All files processed!"
```

## Cross-Server Workflows

### Workflow: Local File to GitHub Issue

**Scenario**: Create GitHub issue from local markdown file

```bash
#!/bin/bash

# Step 1: Read local file
echo "Reading issue template..."
TEMPLATE=$(mcp tools exec filesystem read_file \
  --args '{"path":"templates/bug-report.md"}')

CONTENT=$(echo "$TEMPLATE" | jq -r '.data.content[0].text')

# Step 2: Extract title and body
TITLE=$(echo "$CONTENT" | head -n 1 | sed 's/^# //')
BODY=$(echo "$CONTENT" | tail -n +3)

# Step 3: Create GitHub issue
echo "Creating GitHub issue..."
ISSUE=$(mcp tools exec github create_issue \
  --args "{
    \"owner\":\"myorg\",
    \"repo\":\"myrepo\",
    \"title\":\"$TITLE\",
    \"body\":\"$BODY\",
    \"labels\":[\"bug\",\"automated\"]
  }")

# Step 4: Get issue number
ISSUE_NUMBER=$(echo "$ISSUE" | jq -r '.data.number')
ISSUE_URL=$(echo "$ISSUE" | jq -r '.data.html_url')

echo "✅ Issue #$ISSUE_NUMBER created: $ISSUE_URL"

# Step 5: Save issue reference locally
echo "Saving issue reference..."
mcp tools exec filesystem write_file \
  --args "{
    \"path\":\"issues/issue-$ISSUE_NUMBER.json\",
    \"content\":$(echo "$ISSUE" | jq -c '.data')
  }"

echo "✅ Workflow complete!"
```

### Workflow: CI/CD Debugging

**Scenario**: Analyze failed CI build, create issue with logs

```bash
#!/bin/bash

PROJECT="myorg/myrepo"
BUILD_ID="12345"

# Step 1: Get CI build logs
echo "Fetching CI logs..."
LOGS=$(mcp tools exec ci_server get_logs \
  --args "{\"project\":\"$PROJECT\",\"buildId\":\"$BUILD_ID\"}" \
  --max-tokens 2000)

# Step 2: Analyze for errors (using AI or grep)
ERROR_LINES=$(echo "$LOGS" | jq -r '.data.content[0].text' | grep -i "error" | head -10)

# Step 3: Read relevant source files mentioned in errors
SOURCE_FILE=$(echo "$ERROR_LINES" | grep -oP '(?<=File ").*?(?=")' | head -1)

if [ -n "$SOURCE_FILE" ]; then
  echo "Reading source file: $SOURCE_FILE"
  SOURCE_CODE=$(mcp tools exec filesystem read_file \
    --args "{\"path\":\"$SOURCE_FILE\"}" \
    --max-tokens 1000)
fi

# Step 4: Create detailed GitHub issue
echo "Creating debug issue..."
ISSUE_BODY="## Build Failure Report

**Build ID**: $BUILD_ID
**Failed At**: $(date -u +%Y-%m-%dT%H:%M:%SZ)

### Error Summary
\`\`\`
$ERROR_LINES
\`\`\`

### Related Code
File: \`$SOURCE_FILE\`
\`\`\`
$(echo "$SOURCE_CODE" | jq -r '.data.content[0].text' | head -20)
\`\`\`

[Full Build Logs](https://ci.example.com/builds/$BUILD_ID)
"

mcp tools exec github create_issue \
  --args "{
    \"owner\":\"myorg\",
    \"repo\":\"myrepo\",
    \"title\":\"CI Build #$BUILD_ID Failed\",
    \"body\":$(echo "$ISSUE_BODY" | jq -R -s '.'),
    \"labels\":[\"ci\",\"bug\",\"automated\"]
  }"

echo "✅ Debug issue created"
```

## Error Recovery

### Pattern: Retry with Exponential Backoff

```bash
#!/bin/bash

retry_with_backoff() {
  local max_attempts=5
  local timeout=1
  local attempt=1
  local exitCode=0

  while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt of $max_attempts..."

    "$@"
    exitCode=$?

    if [ $exitCode -eq 0 ]; then
      echo "✅ Success!"
      return 0
    fi

    if [ $attempt -lt $max_attempts ]; then
      echo "⚠️  Failed with exit code $exitCode. Retrying in ${timeout}s..."
      sleep $timeout
      timeout=$((timeout * 2))
    fi

    attempt=$((attempt + 1))
  done

  echo "❌ Failed after $max_attempts attempts"
  return $exitCode
}

# Usage
retry_with_backoff mcp tools exec github create_issue \
  --args '{"owner":"myorg","repo":"myrepo","title":"Test","body":"Test issue"}'
```

### Pattern: Graceful Degradation

```bash
#!/bin/bash

# Primary approach: Use recommended tool
echo "Attempting primary workflow..."
RESULT=$(mcp tools exec advanced_service process_data \
  --args '{"input":"data.json"}' 2>&1)

if echo "$RESULT" | jq -e '.success' > /dev/null 2>&1; then
  echo "✅ Primary workflow succeeded"
  echo "$RESULT" | jq '.data'
else
  # Fallback: Use alternative tool
  echo "⚠️  Primary failed, trying fallback..."
  FALLBACK=$(mcp tools exec basic_service process_data \
    --args '{"input":"data.json"}')

  if echo "$FALLBACK" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ Fallback succeeded"
    echo "$FALLBACK" | jq '.data'
  else
    echo "❌ Both workflows failed"
    exit 1
  fi
fi
```

### Pattern: Transactional Batch with Rollback

```bash
#!/bin/bash

# Attempt transactional batch
echo "Executing transactional batch..."
RESULT=$(mcp tools batch database --transactional --operations '[
  {"tool":"begin_transaction","args":{}},
  {"tool":"insert_record","args":{"table":"users","data":{"name":"John"}}},
  {"tool":"insert_record","args":{"table":"profiles","data":{"userId":1}}},
  {"tool":"commit_transaction","args":{}}
]' 2>&1)

if echo "$RESULT" | jq -e '.success' > /dev/null 2>&1; then
  echo "✅ All database operations committed"
else
  echo "❌ Transaction failed and rolled back"
  echo "Error:" $(echo "$RESULT" | jq -r '.error.message')
  echo "Suggestion:" $(echo "$RESULT" | jq -r '.error.suggestion')
  exit 1
fi
```

## Context Management

### Strategy 1: Chunked Processing

**Use when**: Processing large amounts of data that would exceed context limits

```bash
#!/bin/bash

CHUNK_SIZE=500  # tokens per chunk

# Read large file with chunking
echo "Processing large file in chunks..."

# Get file size first
FILE_INFO=$(mcp tools exec filesystem get_file_info \
  --args '{"path":"large-log.txt"}')

TOTAL_LINES=$(echo "$FILE_INFO" | jq -r '.data.lines')
CHUNKS=$((TOTAL_LINES / 100 + 1))  # ~100 lines per chunk

for ((i=0; i<$CHUNKS; i++)); do
  START=$((i * 100))

  echo "Processing chunk $((i+1))/$CHUNKS..."

  CHUNK=$(mcp tools exec filesystem read_file \
    --args "{\"path\":\"large-log.txt\",\"startLine\":$START,\"lines\":100}" \
    --max-tokens $CHUNK_SIZE)

  # Process chunk
  echo "$CHUNK" | jq -r '.data.content[0].text' | grep "ERROR" >> errors.txt
done

echo "✅ Processed $CHUNKS chunks, errors saved to errors.txt"
```

### Strategy 2: Streaming Results

**Use when**: Real-time processing of operations

```bash
#!/bin/bash

# Process files as they're discovered (streaming pattern)
mcp tools exec filesystem watch_directory \
  --args '{"path":"./incoming","pattern":"*.json"}' | \
while read -r EVENT; do
  FILE=$(echo "$EVENT" | jq -r '.file')

  echo "New file detected: $FILE"

  # Process immediately
  mcp tools exec data_processor process \
    --args "{\"file\":\"./incoming/$FILE\"}"

  # Move to processed
  mcp tools exec filesystem move_file \
    --args "{\"from\":\"./incoming/$FILE\",\"to\":\"./processed/$FILE\"}"
done
```

### Strategy 3: Summary Aggregation

**Use when**: Need to keep context minimal while processing many items

```bash
#!/bin/bash

# Initialize summary
TOTAL=0
SUCCESS=0
FAILED=0

# Process items and aggregate only
while read -r ITEM; do
  RESULT=$(mcp tools exec processor process \
    --args "{\"item\":\"$ITEM\"}")

  TOTAL=$((TOTAL + 1))

  if echo "$RESULT" | jq -e '.success' > /dev/null; then
    SUCCESS=$((SUCCESS + 1))
  else
    FAILED=$((FAILED + 1))
    # Only keep failed item details
    echo "$ITEM: $(echo "$RESULT" | jq -r '.error.message')" >> failures.log
  fi
done < items.txt

# Final summary (minimal context)
echo "Processing complete:"
echo "  Total: $TOTAL"
echo "  Success: $SUCCESS"
echo "  Failed: $FAILED"
[ $FAILED -gt 0 ] && echo "  See failures.log for details"
```

## Next Steps

- **Agent Integration**: See [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) for integration patterns
- **API Reference**: See [API_REFERENCE.md](./API_REFERENCE.md) for command details
- **Examples**: See [examples/workflows/](../examples/workflows/) for working code

---

For more information, visit the [main README](../README.md).
