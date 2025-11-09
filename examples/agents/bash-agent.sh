#!/usr/bin/env bash

#
# Bash Agent Example
#
# Demonstrates a minimal agent implementation using only bash and jq
# for quick prototyping and shell automation.
#

set -euo pipefail

# Configuration
MCP_COMMAND="${MCP_COMMAND:-deno run --allow-all src/cli.ts}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $*" >&2
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $*" >&2
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

# Execute MCP command and return JSON
exec_mcp() {
  local command="$1"
  log_info "Running: $MCP_COMMAND $command"

  local output
  output=$($MCP_COMMAND $command 2>&1)

  # Check if output is valid JSON
  if ! echo "$output" | jq empty 2>/dev/null; then
    log_error "Invalid JSON response: $output"
    return 1
  fi

  echo "$output"
}

# Phase 1: Discover relevant tools for a task
discover() {
  local task="$1"

  log_info "DISCOVER: Finding tools for '$task'"

  local response
  response=$(exec_mcp "discover \"$task\"")

  # Check if successful
  if ! echo "$response" | jq -e '.success' >/dev/null; then
    local error_msg
    error_msg=$(echo "$response" | jq -r '.error.message // "Unknown error"')
    log_error "Discovery failed: $error_msg"
    return 1
  fi

  # Extract discovery data
  local matches_count
  matches_count=$(echo "$response" | jq '.data.matches | length')

  log_success "Found $matches_count matching tools"

  # Check for suggested batch
  if echo "$response" | jq -e '.data.suggested_batch' >/dev/null; then
    local server
    local ops_count
    server=$(echo "$response" | jq -r '.data.suggested_batch.server')
    ops_count=$(echo "$response" | jq '.data.suggested_batch.operations | length')
    log_info "Suggested batch: $server ($ops_count operations)"
  fi

  # Show token usage
  local tokens
  tokens=$(echo "$response" | jq -r '.metadata.tokensEstimate // "unknown"')
  log_info "Tokens used: ~$tokens"

  echo "$response"
}

# Phase 2: Load schemas for specific tools
load_schemas() {
  local server="$1"
  shift
  local tools=("$@")

  log_info "SCHEMA: Loading schemas for ${#tools[@]} tools from $server"

  local tool_list="${tools[*]}"
  local response
  response=$(exec_mcp "tools schema $server $tool_list")

  # Check if successful
  if ! echo "$response" | jq -e '.success' >/dev/null; then
    local error_msg
    error_msg=$(echo "$response" | jq -r '.error.message // "Unknown error"')
    log_error "Schema loading failed: $error_msg"
    return 1
  fi

  local tokens
  tokens=$(echo "$response" | jq -r '.metadata.tokensEstimate // "unknown"')
  log_success "Loaded ${#tools[@]} schemas (~$tokens tokens)"

  echo "$response"
}

# Phase 3: Execute a single tool
exec_tool() {
  local server="$1"
  local tool="$2"
  local args="$3"

  log_info "EXEC: Executing $server:$tool"

  # Escape quotes in args
  local args_escaped
  args_escaped=$(echo "$args" | sed 's/"/\\"/g')

  local response
  response=$(exec_mcp "tools exec $server $tool --args \"$args_escaped\"")

  # Check if successful
  if ! echo "$response" | jq -e '.success' >/dev/null; then
    local error_msg
    error_msg=$(echo "$response" | jq -r '.error.message // "Unknown error"')
    log_error "Execution failed: $error_msg"
    return 1
  fi

  local exec_time
  exec_time=$(echo "$response" | jq -r '.metadata.executionTime // "unknown"')
  log_success "Success (${exec_time}ms)"

  echo "$response"
}

# Phase 3: Execute multiple tools in batch
exec_batch() {
  local server="$1"
  local operations="$2"
  local transactional="${3:-false}"

  local ops_count
  ops_count=$(echo "$operations" | jq 'length')

  log_info "BATCH: Executing $ops_count operations on $server"

  # Build command
  local tx_flag=""
  if [[ "$transactional" == "true" ]]; then
    tx_flag="--transactional"
  fi

  # Escape quotes in operations
  local ops_escaped
  ops_escaped=$(echo "$operations" | sed 's/"/\\"/g')

  local response
  response=$(exec_mcp "tools batch $server $tx_flag --operations \"$ops_escaped\"")

  # Check if successful
  if ! echo "$response" | jq -e '.success' >/dev/null; then
    local error_msg
    error_msg=$(echo "$response" | jq -r '.error.message // "Unknown error"')
    log_error "Batch execution failed: $error_msg"
    return 1
  fi

  local exec_time
  exec_time=$(echo "$response" | jq -r '.metadata.executionTime // "unknown"')
  log_success "Success (${exec_time}ms)"

  echo "$response"
}

# Infer arguments for a tool (simplified)
infer_arguments() {
  local tool_name="$1"
  local task="$2"

  log_info "INFER: Inferring arguments for $tool_name"

  local args="{}"

  case "$tool_name" in
  browser_navigate)
    # Extract URL from task or use default
    local url
    url=$(echo "$task" | grep -oP 'https?://[^\s]+' | head -1 || echo "https://example.com")
    args=$(jq -n --arg url "$url" '{url: $url}')
    ;;
  browser_screenshot)
    args='{"filename":"screenshot.png","fullPage":true}'
    ;;
  read_file)
    # Extract file path from task
    local path
    path=$(echo "$task" | grep -oP '["'\'']\K[^"'\'']+(?=["'\''])' | head -1 || echo "README.md")
    args=$(jq -n --arg path "$path" '{path: $path}')
    ;;
  esac

  log_info "Arguments: $args"
  echo "$args"
}

# Execute a task using the full workflow
execute_task() {
  local task="$1"

  echo "========================================" >&2
  echo "TASK: $task" >&2
  echo "========================================" >&2

  # Phase 1: Discovery
  local discovery
  discovery=$(discover "$task")

  # Check if we found any matches
  local matches_count
  matches_count=$(echo "$discovery" | jq '.data.matches | length')

  if [[ "$matches_count" -eq 0 ]]; then
    log_error "No matching tools found for the task"
    return 1
  fi

  # Phase 2: Decide on execution strategy
  if echo "$discovery" | jq -e '.data.suggested_batch' >/dev/null; then
    # Use batch execution
    log_info "STRATEGY: Using batch execution"

    local server
    server=$(echo "$discovery" | jq -r '.data.suggested_batch.server')

    # Get operations from suggested batch
    local operations
    operations=$(echo "$discovery" | jq -r '.data.suggested_batch.operations[]')

    # Load schemas
    mapfile -t ops_array <<<"$operations"
    load_schemas "$server" "${ops_array[@]}" >/dev/null

    # Build batch operations with inferred arguments
    local batch_ops="["
    local first=true

    for tool_name in "${ops_array[@]}"; do
      local args
      args=$(infer_arguments "$tool_name" "$task")

      if [[ "$first" == "true" ]]; then
        first=false
      else
        batch_ops+=","
      fi

      batch_ops+="{\"tool\":\"$tool_name\",\"args\":$args}"
    done

    batch_ops+="]"

    # Execute batch
    exec_batch "$server" "$batch_ops"
  else
    # Use single tool execution
    log_info "STRATEGY: Using single tool execution"

    local server
    local tool
    local confidence

    server=$(echo "$discovery" | jq -r '.data.matches[0].server')
    tool=$(echo "$discovery" | jq -r '.data.matches[0].tool')
    confidence=$(echo "$discovery" | jq -r '.data.matches[0].confidence')

    log_info "Using: $server:$tool (confidence: $confidence)"

    # Load schema
    load_schemas "$server" "$tool" >/dev/null

    # Infer arguments
    local args
    args=$(infer_arguments "$tool" "$task")

    # Execute
    exec_tool "$server" "$tool" "$args"
  fi
}

# Main entry point
main() {
  if [[ $# -eq 0 ]]; then
    echo "Usage: bash-agent.sh <task-description>" >&2
    echo "" >&2
    echo "Examples:" >&2
    echo '  bash-agent.sh "navigate to google.com and take a screenshot"' >&2
    echo '  bash-agent.sh "read the README.md file"' >&2
    exit 1
  fi

  local task="$*"

  # Check for jq
  if ! command -v jq &>/dev/null; then
    log_error "jq is required but not installed. Install it with: apt-get install jq"
    exit 1
  fi

  local result
  if result=$(execute_task "$task"); then
    echo ""
    echo "=== RESULT ==="
    echo "$result" | jq '.data'
  else
    echo ""
    echo "=== ERROR ===" >&2
    exit 1
  fi
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
