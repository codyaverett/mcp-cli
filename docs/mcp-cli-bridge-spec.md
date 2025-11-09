# MCP CLI Bridge - Technical Specification

**Package Name:** `@cosmic/mcp-cli`  
**Version:** 1.0  
**Date:** November 8, 2025  
**Author:** Commander  
**Status:** Design Phase  
**Runtime:** Deno (with Node.js compatibility)  
**Registry:** JSR (jsr.io/@cosmic/mcp-cli)

## Executive Summary

The MCP CLI Bridge (`@cosmic/mcp-cli`) is a cross-platform command-line tool that enables AI assistants to interact with Model Context Protocol (MCP) servers through shell access, effectively bypassing platform-specific configuration restrictions while maintaining security and clean architecture patterns.

**More importantly,** it implements a progressive disclosure pattern that solves a fundamental problem with LLM tool architectures: **context pollution from eager loading of tool definitions.**

This tool is AI platform agnostic, working with any LLM that has shell/command execution capabilities (Claude with bash_tool, ChatGPT with code interpreter, GitHub Copilot, custom agents, etc.).

## Why This Matters: The Attention Problem

### The Transformer Limitation

Transformers (the architecture behind Claude, GPT-4, and other LLMs) use attention mechanisms that struggle to completely ignore information in context. When you load 100 tool definitions totaling 30,000 tokens:

- **Every token attends to every other token** (quadratically scaled attention)
- **The model can't pay zero attention** to irrelevant tools
- **"Attention sinks" help but don't eliminate** the problem
- **Reasoning quality degrades** with irrelevant context

This isn't just theory—it's measurable performance degradation across all major LLM platforms, even those advertising 200K+ token windows.

### The Traditional Approach (Broken)

```
Load ALL tools upfront (eager loading):
├── filesystem (12 tools × 200 tokens = 2,400)
├── github (28 tools × 300 tokens = 8,400)  
├── slack (18 tools × 250 tokens = 4,500)
├── jira (32 tools × 300 tokens = 9,600)
├── database (15 tools × 400 tokens = 6,000)
└── custom-api (20 tools × 200 tokens = 4,000)

Result: 35,000 tokens of context pollution
Problem: User asks to "read a file" and model wastes attention on 124 irrelevant tools
```

### The CLI Bridge Approach (Correct)

```
Load NOTHING upfront (lazy loading):
├── Context: 0 tokens

User asks to "read a file":
1. Discover servers: 50 tokens
2. Find filesystem tools: 100 tokens  
3. Load read_file schema: 200 tokens
4. Execute

Result: 350 tokens for tool discovery
Savings: 99% reduction in context pollution
Benefit: Model attention 100% focused on the actual task
```

### Real Impact

**Scenario:** Multi-step development task across 6 tools from 3 servers

- **Eager Loading:** 18,000 tokens loaded, 15,000 wasted (83% waste)
- **Lazy Loading:** 1,650 tokens loaded, 0 wasted (100% utilized)
- **Quality Improvement:** Measurably better reasoning with cleaner context

This isn't just an optimization—it's **how LLM tool systems should be architected by default.**

### Platform Compatibility

This approach works with any AI assistant that can execute shell commands:

- **Claude:** via `bash_tool` 
- **ChatGPT:** via Code Interpreter / Advanced Data Analysis
- **GitHub Copilot:** via terminal integration
- **Custom Agents:** via subprocess/shell execution
- **Any LLM framework:** LangChain, AutoGPT, etc.

## 1. Project Overview

### 1.1 Problem Statement

**Primary Issue: Context Pollution**

Loading all MCP tools directly into an LLM's context creates significant cognitive overhead:

- **Token Bloat:** 50-100+ tool descriptions can consume 20-50K tokens
- **Attention Degradation:** Transformer attention mechanisms struggle to ignore irrelevant context
- **Reasoning Quality:** Model performance degrades when forced to consider irrelevant tools
- **Hallucination Risk:** Similar tool names across servers increase confusion
- **Inefficiency:** "Attention sinks" help but don't eliminate the fundamental problem

Even with models advertising 200K+ token context windows, having irrelevant tool descriptions loaded reduces reasoning quality. The attention mechanism can't truly pay *zero* attention to something in context.

**Secondary Issue: Platform & Enterprise Restrictions**

Different AI platforms may have varying levels of MCP support:
- Enterprise deployments may restrict direct MCP protocol access
- Some platforms don't support MCP natively
- Network configuration and security policies vary
- Platform-specific tool integration requirements differ

### 1.2 Solution Philosophy

**Just-In-Time Tool Discovery**

Instead of loading all tools upfront (eager loading), implement a lazy loading pattern where the AI assistant discovers and loads only the specific tools needed for the current task:

1. **Discovery Phase:** Query available servers/tools without loading schemas
2. **Schema Phase:** Load detailed tool descriptions only when needed
3. **Execution Phase:** Use the tool with minimal context overhead
4. **Cleanup:** Tools "expire" from context naturally as conversation progresses

**Implementation: CLI Bridge**

Build a cross-platform CLI tool that:
- Acts as an MCP client on behalf of any AI assistant
- Enables progressive disclosure through targeted queries
- Exposes MCP capabilities through simple shell commands
- Communicates via stdin/stdout (accessible through shell execution)
- Supports dynamic tool discovery and lazy schema loading
- Works on Windows, macOS, and Linux

### 1.3 Key Benefits

- **Context Efficiency:** Load only what's needed, when it's needed (90%+ reduction in tool-related tokens)
- **Better Reasoning:** Cleaner context = better attention focus = higher quality outputs
- **Reduced Hallucination:** Fewer similar tools in context reduces confusion
- **Scalability:** Can work with hundreds of tools across dozens of servers
- **Platform Agnostic:** Works with any AI assistant that can execute shell commands
- **Cross-Platform:** Single codebase runs on Windows, macOS, Linux
- **Developer Friendly:** Simple CLI interface with JSON I/O
- **Compositional Workflows:** Load tools progressively as multi-step plans unfold

## 2. Architecture

### 2.1 High-Level Architecture

```
┌──────────────────────────┐
│   AI Assistant           │
│   (Claude, GPT, etc.)    │
│                          │
│  ┌────────────────────┐  │
│  │ Shell Execution    │  │
│  │ (bash, cmd, etc.)  │  │
│  └─────────┬──────────┘  │
└────────────┼─────────────┘
             │
             ▼
    ┌─────────────────┐
    │  @cosmic/       │
    │  mcp-cli        │
    │                 │
    │ ┌─────────────┐ │
    │ │ MCP Client  │ │
    │ └─────────────┘ │
    └────────┬────────┘
             │
             ▼
┌─────────────────────────┐
│   MCP Servers           │
│                         │
│  • Local Servers        │
│  • Remote Servers       │
│  • Tools/Resources      │
│  • Prompts             │
└─────────────────────────┘
```

### 2.2 Component Breakdown

#### 2.2.1 CLI Interface Layer
- Command parser (platform-agnostic)
- Input validation
- Output formatting (JSON)
- Error handling and reporting
- Cross-platform path handling

#### 2.2.2 MCP Protocol Layer
- MCP client implementation
- Connection management
- Transport abstraction (stdio, SSE, HTTP)
- Protocol message handling

#### 2.2.3 Server Registry
- Configuration management
- Server discovery
- Connection pooling
- Health checking

#### 2.2.4 Execution Layer
- Tool invocation
- Resource fetching
- Prompt management
- Response streaming

## 3. Context Management Strategy

### 3.1 The Problem: Eager Loading

**Traditional MCP Integration (Direct Tools):**

```
Claude's Context:
├── System Prompt: 2,000 tokens
├── Conversation History: 5,000 tokens
├── User Message: 500 tokens
└── Tool Definitions: 35,000 tokens ❌
    ├── filesystem (12 tools × 200 tokens = 2,400 tokens)
    ├── github (28 tools × 300 tokens = 8,400 tokens)
    ├── slack (18 tools × 250 tokens = 4,500 tokens)
    ├── jira (32 tools × 300 tokens = 9,600 tokens)
    ├── database (15 tools × 400 tokens = 6,000 tokens)
    └── custom-api (20 tools × 200 tokens = 4,000 tokens)

Total Context: 42,500 tokens
Attention Overhead: Constant evaluation of 125 irrelevant tools
```

When user asks: "Read the README file"
- Only needs: `filesystem.read_file` (~200 tokens)
- Gets loaded: All 125 tools (~35,000 tokens)
- Wasted: ~34,800 tokens of context pollution

### 3.2 The Solution: Progressive Disclosure

**CLI Bridge Pattern (Lazy Loading):**

```
Claude's Context:
├── System Prompt: 2,000 tokens
├── Conversation History: 5,000 tokens
├── User Message: 500 tokens
└── Tool Definitions: 0 tokens ✅

Total Context: 7,500 tokens
```

**When user asks: "Read the README file"**

```typescript
// Step 1: Discover relevant server (minimal query)
await bash_tool('mcp-cli servers list --names-only');
// Output: ["filesystem", "github", "slack", "jira", "database", "custom-api"]
// Context cost: ~100 tokens for result

// Step 2: Check what filesystem can do (still minimal)
await bash_tool('mcp-cli tools list filesystem --names-only');
// Output: ["read_file", "write_file", "list_directory", ...]
// Context cost: ~150 tokens for result

// Step 3: Load ONLY the needed tool schema
await bash_tool('mcp-cli tools schema filesystem read_file');
// Output: Full schema for read_file only
// Context cost: ~200 tokens for this ONE tool

// Step 4: Use it
await bash_tool('mcp-cli tools exec filesystem read_file --args \'{"path": "README.md"}\'');
// Context cost: Input args + output content (variable)

Total Tool Discovery Cost: ~450 tokens vs 35,000 tokens
Savings: 98.7% reduction in tool-related context pollution
```

### 3.3 Progressive Disclosure Patterns

#### Pattern 1: Name-Only Discovery

```bash
# List servers without any tool details
mcp-cli servers list --names-only
# Output: Array of server names only (~10-50 tokens)

# List tools without schemas
mcp-cli tools list <server> --names-only
# Output: Array of tool names only (~50-200 tokens)
```

#### Pattern 2: Filtered Discovery

```bash
# Search across all servers for relevant capabilities
mcp-cli tools search "file operations"
# Output: Only tools matching the search term with minimal metadata

# Filter by category/tag (if server supports it)
mcp-cli tools list github --category "repository"
```

#### Pattern 3: Just-In-Time Schema Loading

```bash
# Load schema only when about to use a tool
mcp-cli tools schema <server> <tool-name>
# Output: Full schema for ONE specific tool

# Or get multiple schemas at once if you know you'll need them
mcp-cli tools schema github create_issue get_issue update_issue
```

#### Pattern 4: Batch Operations with Minimal Overhead

```bash
# Execute multiple tools without loading all schemas
mcp-cli batch exec <<EOF
{
  "operations": [
    {"server": "filesystem", "tool": "read_file", "args": {"path": "a.txt"}},
    {"server": "filesystem", "tool": "read_file", "args": {"path": "b.txt"}},
    {"server": "github", "tool": "create_issue", "args": {...}}
  ]
}
EOF
```

### 3.4 Context Lifecycle Management

**Implicit Cleanup:**

Tool definitions naturally "age out" of context as conversation progresses:

```
Turn 1: "Read README"
  → Load filesystem.read_file schema
  → Execute
  → Context contains 1 tool schema

Turn 2: "Create a GitHub issue about that"
  → Load github.create_issue schema  
  → Execute
  → Context contains 2 tool schemas

Turn 10: Discussing something completely different
  → Previous tool schemas no longer relevant
  → Attention mechanism still wastes cycles on them
  → BUT: Only 2 tools in context, not 125 ✅
```

**Explicit Cleanup (Future Enhancement):**

```bash
# Clear tool schema cache if context gets too full
mcp-cli tools clear-cache

# Or let Claude detect when to refresh
if context_getting_full():
    forget_old_tool_schemas()
    load_only_current_needs()
```

### 3.5 Real-World Impact

**Scenario: Multi-Step Development Task**

"Set up a new project: create a repo, scaffold files, set up CI, create initial issues"

**Eager Loading:**
- Preload: github (28 tools), filesystem (12 tools), CI server (20 tools)
- Context cost: ~18,000 tokens before starting
- Actually used: 6 tools total
- Waste: ~15,000 tokens (83%)

**Lazy Loading:**
- Turn 1: Load github.create_repo (~300 tokens)
- Turn 2: Load filesystem.write_file (~200 tokens)  
- Turn 3: Load filesystem.create_directory (~200 tokens)
- Turn 4: Load ci.create_workflow (~400 tokens)
- Turn 5: Load github.create_issue (~300 tokens)
- Turn 6: Load github.add_labels (~250 tokens)
- Context cost: ~1,650 tokens total
- Waste: ~0 tokens (everything loaded was used)
- **Savings: 91% reduction**

### 3.6 Design Principles

1. **Never Load What You Don't Need:** Default to names-only, escalate to schemas only when executing
2. **Minimize Discovery Overhead:** Fast, lightweight queries for server/tool enumeration
3. **Cache Intelligently:** Remember schemas within a session but don't persist globally
4. **Support Exploration:** Make it easy to browse capabilities without polluting context
5. **Fail Fast:** Clear errors if a tool doesn't exist, don't load everything to search

## 4. Technical Requirements

### 4.1 Platform Support

- **Primary Runtime:** Deno 2.0+
- **Compatibility:** Node.js 18+ (via Deno's Node compatibility layer)
- **OS Support:** Windows, macOS, Linux
- **Distribution:** JSR (JavaScript Registry) as `@cosmic/mcp-cli`
- **Installation Methods:**
  - Global: `deno install -g -A -n mcp jsr:@cosmic/mcp-cli`
  - NPM compatibility: `npx jsr:@cosmic/mcp-cli`
  - Standalone binaries: Pre-compiled for each platform

### 4.2 Why Deno?

**Advantages over Node.js:**
- **Built-in TypeScript:** No build step required
- **Better Security:** Explicit permissions for file/network access
- **Modern stdlib:** Comprehensive standard library
- **Standalone Compilation:** `deno compile` creates single executables
- **JSR Native:** First-class support for JSR registry
- **Faster Startup:** Optimized for CLI tools
- **No node_modules:** Cleaner dependency management

**Node Compatibility:**
- Use Deno's node: imports for compatibility
- Test against both Deno and Node runtimes
- Ensure all dependencies work in both environments

### 4.3 Dependencies

```jsonc
// deno.json
{
  "name": "@cosmic/mcp-cli",
  "version": "1.0.0",
  "exports": "./src/index.ts",
  "imports": {
    "@modelcontextprotocol/sdk": "npm:@modelcontextprotocol/sdk@latest",
    "@cliffy/command": "jsr:@cliffy/command@^1.0.0",
    "@std/jsonc": "jsr:@std/jsonc@^1.0.0",
    "@std/path": "jsr:@std/path@^1.0.0",
    "@std/fs": "jsr:@std/fs@^1.0.0",
    "zod": "npm:zod@^3.x"
  },
  "tasks": {
    "dev": "deno run --allow-all src/index.ts",
    "compile": "deno compile --allow-all --output=bin/mcp src/index.ts",
    "test": "deno test --allow-all"
  }
}
```

**Key Packages:**
- **@cliffy/command:** Modern CLI framework for Deno (replaces Commander.js)
- **@modelcontextprotocol/sdk:** Official MCP TypeScript SDK (via npm:)
- **@std/*:** Deno standard library modules
- **zod:** Runtime type validation

### 4.4 Performance Requirements

- **Startup Time:** < 200ms (Deno's fast startup)
- **Command Execution:** < 2s for most operations
- **Memory Footprint:** < 50MB under normal load (no node_modules overhead)
- **Concurrent Connections:** Support 10+ simultaneous MCP servers
- **Binary Size:** < 30MB compiled (Deno compile with compression)

### 4.5 Cross-Platform Considerations

**Windows:**
- Handle both forward and backslashes in paths
- Support cmd.exe, PowerShell, and Git Bash
- Use Windows-specific environment variables when needed
- Test with Windows Defender and enterprise antivirus

**macOS:**
- Code signing for distribution (optional, for trusted binaries)
- Handle case-sensitive filesystem differences
- Support both Intel and Apple Silicon (arm64)

**Linux:**
- Support various distributions (Ubuntu, Fedora, Alpine)
- Handle different shell environments (bash, zsh, fish)
- Respect XDG base directory specification for config

**Path Handling:**
- Use `@std/path` for all path operations
- Always normalize paths before use
- Support both absolute and relative paths
- Handle ~ (home directory) expansion

## 5. API Design

### 5.1 Command Structure

```bash
mcp-cli [command] [options]
```

### 5.2 Design Philosophy

**Commands are optimized for minimal context overhead:**

1. **List operations default to names-only** (use `--full` for schemas)
2. **Schema loading is explicit** (use `schema` command)
3. **Search is server-scoped** (prevents loading all servers)
4. **Output is always JSON** (consistent parsing)

### 5.3 Core Commands

#### 5.3.1 Server Management

```bash
# List configured servers (names only)
mcp-cli servers list --names-only
# Output: ["filesystem", "github", "slack"]

# List servers with full details
mcp-cli servers list --full
# Output: Full server configurations with health status

# Add a server
mcp-cli servers add <name> --type <stdio|sse|http> --config <path>

# Remove a server
mcp-cli servers remove <name>

# Test server connection
mcp-cli servers test <name>

# Get server info (capabilities, version, etc.)
mcp-cli servers info <name>
```

#### 5.3.2 Tool Operations (Progressive Disclosure)

```bash
# List tool names only (minimal context cost)
mcp-cli tools list <server-name> --names-only
# Output: ["read_file", "write_file", "list_directory"]
# ~50-200 tokens

# List tools with brief descriptions (moderate context)
mcp-cli tools list <server-name> --brief
# Output: Array of {name, brief_description}
# ~500-1000 tokens

# List tools with full schemas (high context cost - avoid unless needed)
mcp-cli tools list <server-name> --full
# Output: Full tool schemas
# ~2000-5000 tokens

# Get schema for specific tool(s) - ONLY when about to use
mcp-cli tools schema <server-name> <tool-name> [tool-name2] [...]
# Output: Full JSON schema for specified tools only
# ~200-500 tokens per tool

# Search for tools across a specific server
mcp-cli tools search <server-name> <query>
# Output: Matching tools with brief descriptions
# ~100-500 tokens

# Execute a tool
mcp-cli tools exec <server-name> <tool-name> --args '{"param": "value"}'
# Output: Tool execution result

# Execute with streaming (for long-running operations)
mcp-cli tools exec <server-name> <tool-name> --args '{"param": "value"}' --stream
```

#### 5.3.3 Resource Operations

```bash
# List resources (names/URIs only)
mcp-cli resources list <server-name> --names-only
# Output: Array of resource URIs

# List resources with metadata
mcp-cli resources list <server-name> --full

# Read a specific resource
mcp-cli resources read <server-name> <resource-uri>

# Get resource schema/template
mcp-cli resources schema <server-name> <resource-uri>

# Subscribe to resource updates (if server supports)
mcp-cli resources subscribe <server-name> <resource-uri>

# Search resources by pattern
mcp-cli resources search <server-name> <pattern>
```

#### 5.3.4 Prompt Operations

```bash
# List available prompts (names only)
mcp-cli prompts list <server-name> --names-only

# List prompts with descriptions
mcp-cli prompts list <server-name> --full

# Get prompt schema (required arguments)
mcp-cli prompts schema <server-name> <prompt-name>

# Get/execute prompt with arguments
mcp-cli prompts get <server-name> <prompt-name> --args '{"var": "value"}'
```

#### 5.3.5 Discovery & Search Operations

```bash
# Search across ALL servers for a capability (filtered server query)
mcp-cli search "file operations"
# Output: { "filesystem": ["read_file", "write_file"], "github": ["get_file"] }

# Inspect what a server provides without loading schemas
mcp-cli inspect <server-name>
# Output: { "tools": 12, "resources": 5, "prompts": 3, "capabilities": [...] }

# Get recommendations for a task description
mcp-cli recommend "I need to read a file and create a GitHub issue"
# Output: Suggested tools in execution order with minimal metadata
```

#### 5.3.6 Batch Operations

```bash
# Execute multiple operations in sequence
mcp-cli batch exec --file operations.json

# operations.json format:
{
  "operations": [
    {
      "server": "filesystem",
      "tool": "read_file",
      "args": {"path": "README.md"},
      "output_var": "readme_content"
    },
    {
      "server": "github",
      "tool": "create_issue",
      "args": {
        "title": "Documentation update",
        "body": "{{readme_content}}"  # Reference previous output
      }
    }
  ]
}
```

### 5.4 Output Format

All commands output JSON for easy parsing:

**Success (Minimal):**
```json
{
  "success": true,
  "data": {
    // Command-specific data
  }
}
```

**Success (Full) - with metadata:**
```json
{
  "success": true,
  "data": {
    // Command-specific data
  },
  "metadata": {
    "server": "server-name",
    "timestamp": "2025-11-08T12:00:00Z",
    "executionTime": 145,
    "tokensEstimate": 250  // Estimate of tokens in response
  }
}
```

**Error format:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "suggestion": "Try: mcp-cli tools list filesystem --names-only"
  }
}
```

### 5.5 Response Size Management

**Commands include size hints to help Claude manage context:**

```json
{
  "success": true,
  "data": [...],
  "metadata": {
    "resultSize": "small",  // small, medium, large
    "tokensEstimate": 150,
    "truncated": false
  }
}
```

**Large results can be paginated or truncated:**

```bash
# Paginate large results
mcp-cli tools list github --names-only --limit 10 --offset 20

# Truncate long output
mcp-cli tools exec filesystem read_file --args '{"path": "large.txt"}' --max-tokens 1000
```

### 5.4 Configuration File

**Location (Cross-Platform):**
- **Windows:** `%USERPROFILE%\.mcp-cli\config.json`
- **macOS/Linux:** `~/.mcp-cli/config.json`
- **XDG (Linux):** `$XDG_CONFIG_HOME/mcp-cli/config.json`

**Format:**

```jsonc
{
  "servers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"],
      "env": {},
      "enabled": true
    },
    "github": {
      "type": "sse",
      "url": "http://localhost:3000/sse",
      "apiKey": "${GITHUB_TOKEN}",  // Environment variable substitution
      "enabled": true
    },
    "slack": {
      "type": "http",
      "url": "https://api.slack.com/mcp",
      "headers": {
        "Authorization": "Bearer ${SLACK_TOKEN}"
      },
      "enabled": true
    }
  },
  "preferences": {
    "defaultTimeout": 30000,
    "maxRetries": 3,
    "logLevel": "info",
    "cacheSchemas": true,
    "cacheTTL": 300  // 5 minutes
  }
}
```

**Environment Variable Substitution:**
- Supports `${VAR_NAME}` syntax
- Falls back to empty string if not set (with warning)
- Validated at runtime, not config load time

## 5. Implementation Details

### 5.1 Project Structure

```
@cosmic/mcp-cli/
├── src/
│   ├── mod.ts                # Main module export
│   ├── cli.ts                # CLI entry point
│   ├── commands/             # Command implementations
│   │   ├── servers.ts
│   │   ├── tools.ts
│   │   ├── resources.ts
│   │   └── prompts.ts
│   ├── client/               # MCP client wrapper
│   │   ├── base.ts
│   │   ├── stdio.ts
│   │   ├── sse.ts
│   │   └── http.ts
│   ├── config/               # Configuration management
│   │   ├── loader.ts
│   │   ├── schema.ts
│   │   └── validator.ts
│   ├── utils/                # Utility functions
│   │   ├── logger.ts
│   │   ├── json.ts
│   │   ├── platform.ts       # Cross-platform helpers
│   │   └── errors.ts
│   └── types/                # TypeScript types
│       ├── config.ts
│       ├── commands.ts
│       └── mcp.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/
│   ├── README.md
│   ├── GETTING_STARTED.md
│   ├── INSTALLATION.md       # Platform-specific install guides
│   └── API.md
├── scripts/
│   ├── build.ts              # Build standalone binaries
│   └── publish.ts            # Publish to JSR
├── deno.json                 # Deno configuration
├── deno.lock                 # Dependency lock file
├── LICENSE
└── README.md
```

### 5.2 Key Implementation Patterns

#### 5.2.1 MCP Client Abstraction

```typescript
// src/client/base.ts
interface MCPClientAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<Tool[]>;
  executeTool(name: string, args: unknown): Promise<unknown>;
  listResources(): Promise<Resource[]>;
  readResource(uri: string): Promise<ResourceContent>;
  listPrompts(): Promise<Prompt[]>;
  getPrompt(name: string, args: Record<string, string>): Promise<PromptMessage[]>;
}
```

#### 5.2.2 Transport Factory

```typescript
// src/client/factory.ts
class MCPClientFactory {
  static create(config: ServerConfig): MCPClientAdapter {
    switch (config.type) {
      case 'stdio':
        return new StdioMCPClient(config);
      case 'sse':
        return new SSEMCPClient(config);
      case 'http':
        return new HTTPMCPClient(config);
      default:
        throw new Error(`Unsupported transport: ${config.type}`);
    }
  }
}
```

#### 5.2.3 Command Pattern with Cliffy

```typescript
// src/commands/tools.ts
import { Command } from "@cliffy/command";

export const toolsCommand = new Command()
  .name("tools")
  .description("Manage and execute tools from MCP servers")
  .action(function() {
    this.showHelp();
  })
  .command("list", "List available tools")
  .option("--names-only", "Show only tool names")
  .option("--brief", "Show brief descriptions")
  .option("--full", "Show full schemas")
  .arguments("<server-name:string>")
  .action(async (options, serverName) => {
    // Implementation
  })
  .command("exec", "Execute a tool")
  .arguments("<server-name:string> <tool-name:string>")
  .option("--args <json:string>", "Tool arguments as JSON")
  .action(async (options, serverName, toolName) => {
    // Implementation
  });
```

#### 5.2.4 Cross-Platform Path Handling

```typescript
// src/utils/platform.ts
import { join, normalize } from "@std/path";

export class Platform {
  static getConfigDir(): string {
    const home = Deno.env.get("HOME") || 
                 Deno.env.get("USERPROFILE") || 
                 "";
    
    if (Deno.build.os === "windows") {
      return join(home, ".mcp-cli");
    }
    
    // Respect XDG on Linux
    const xdgConfig = Deno.env.get("XDG_CONFIG_HOME");
    if (xdgConfig && Deno.build.os === "linux") {
      return join(xdgConfig, "mcp-cli");
    }
    
    return join(home, ".mcp-cli");
  }
  
  static getConfigPath(): string {
    return join(this.getConfigDir(), "config.json");
  }
}
```

### 5.3 Error Handling Strategy

1. **Network Errors:** Retry with exponential backoff
2. **Protocol Errors:** Return structured error with details
3. **Validation Errors:** Fail fast with clear messages
4. **Timeout Errors:** Configurable timeout with graceful cancellation

### 5.4 Logging Strategy

```typescript
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

// Logs to stderr to avoid polluting stdout (JSON output)
logger.info('Connected to MCP server', { server: 'filesystem' });
logger.error('Failed to execute tool', { tool: 'read_file', error });
```

## 6. Security Considerations

### 6.1 Authentication & Authorization

- Support environment variable substitution for secrets (`${VAR_NAME}`)
- Never log or expose credentials in output
- Validate server certificates for HTTPS/SSE connections
- Support custom CA certificates for enterprise environments

### 6.2 Input Validation

- Validate all JSON inputs against schemas
- Sanitize command arguments
- Prevent command injection in stdio transports
- Rate limiting for remote servers

### 6.3 Sandboxing

- Restrict stdio server commands to allowlist (optional)
- Validate resource URIs to prevent path traversal
- Implement resource access controls per server

### 6.4 Audit Logging

Optional audit log for compliance:

```json
{
  "timestamp": "2025-11-08T12:00:00Z",
  "action": "tool.execute",
  "server": "filesystem",
  "tool": "read_file",
  "user": "commander",
  "result": "success"
}
```

## 7. Testing Strategy

### 7.1 Unit Tests

- All commands with mocked MCP clients
- Configuration validation
- Error handling paths
- JSON parsing and formatting

### 7.2 Integration Tests

- Real MCP server connections (test servers)
- End-to-end command execution
- Transport-specific tests
- Timeout and retry logic

### 7.3 Test Coverage Goals

- **Unit Tests:** > 80% coverage
- **Integration Tests:** All major workflows
- **E2E Tests:** Critical user journeys

### 7.4 Test MCP Servers

Create minimal test servers for each transport:

```typescript
// test-servers/echo-stdio.ts
// Simple echo server for stdio testing

// test-servers/mock-sse.ts
// Mock SSE server for testing

// test-servers/mock-http.ts
// Mock HTTP server for testing
```

## 8. Deployment & Distribution

### 8.1 JSR Package Distribution (Primary)

**Publishing to JSR:**

```bash
# Publish to JSR (JavaScript Registry)
deno publish --allow-dirty
```

**Installation (Deno):**

```bash
# Global installation with Deno
deno install -g -A -n mcp jsr:@cosmic/mcp-cli

# Run directly without installing
deno run -A jsr:@cosmic/mcp-cli tools list filesystem

# Import as module
import { MCPClient } from "jsr:@cosmic/mcp-cli";
```

**Installation (Node.js/npm compatibility):**

```bash
# Via npx with JSR
npx jsr:@cosmic/mcp-cli tools list filesystem

# Or using deno's npm compatibility
npm install @cosmic/mcp-cli  # If published to npm as well
```

### 8.2 Standalone Binary Distribution

**Build with Deno Compile:**

```bash
# Build for current platform
deno task compile

# Build for all platforms (requires deno 2.0+)
deno compile --allow-all --target x86_64-unknown-linux-gnu --output bin/mcp-linux src/cli.ts
deno compile --allow-all --target x86_64-apple-darwin --output bin/mcp-macos-intel src/cli.ts
deno compile --allow-all --target aarch64-apple-darwin --output bin/mcp-macos-arm src/cli.ts
deno compile --allow-all --target x86_64-pc-windows-msvc --output bin/mcp.exe src/cli.ts
```

**Binary Naming Convention:**
- Linux: `mcp-linux-x64`
- macOS Intel: `mcp-macos-x64`
- macOS Apple Silicon: `mcp-macos-arm64`
- Windows: `mcp-windows-x64.exe`

**Distribution Channels:**
- GitHub Releases (with binaries attached)
- Homebrew tap (macOS/Linux): `brew install cosmic/tap/mcp-cli`
- Chocolatey (Windows): `choco install mcp-cli`
- Manual download from releases page

### 8.3 Docker Image

```dockerfile
FROM denoland/deno:2.0

WORKDIR /app

# Copy source
COPY . .

# Cache dependencies
RUN deno cache src/cli.ts

# Create non-root user
RUN useradd -m -u 1000 mcp
USER mcp

# Set up config directory
RUN mkdir -p /home/mcp/.mcp-cli

ENTRYPOINT ["deno", "run", "--allow-all", "src/cli.ts"]
```

**Usage:**

```bash
# Build
docker build -t cosmic/mcp-cli .

# Run
docker run -v ~/.mcp-cli:/home/mcp/.mcp-cli cosmic/mcp-cli servers list

# Publish
docker push cosmic/mcp-cli:latest
```

### 8.4 CI/CD Pipeline

**GitHub Actions workflow for releases:**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v2.x
      
      # Publish to JSR
      - name: Publish to JSR
        run: deno publish
        env:
          JSR_TOKEN: ${{ secrets.JSR_TOKEN }}
      
      # Build standalone binaries
      - name: Build binaries
        run: |
          deno task compile
      
      # Create GitHub release
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: bin/*
```

### 8.5 Version Management

**Semantic Versioning:**
- `1.0.0` - Initial stable release
- `1.1.0` - New features (backward compatible)
- `1.0.1` - Bug fixes
- `2.0.0` - Breaking changes

**Version in deno.json:**

```jsonc
{
  "name": "@cosmic/mcp-cli",
  "version": "1.0.0",  // Updated for each release
  // ...
}
```

### 8.6 Platform-Specific Installation Guides

**Windows (PowerShell):**

```powershell
# Using Deno
irm https://deno.land/install.ps1 | iex
deno install -g -A -n mcp jsr:@cosmic/mcp-cli

# Or download binary
Invoke-WebRequest -Uri "https://github.com/cosmic/mcp-cli/releases/latest/download/mcp-windows-x64.exe" -OutFile "$env:USERPROFILE\bin\mcp.exe"
```

**macOS (Homebrew):**

```bash
# Install Deno first
brew install deno

# Install mcp-cli
deno install -g -A -n mcp jsr:@cosmic/mcp-cli

# Or via Homebrew tap (future)
brew install cosmic/tap/mcp-cli
```

**Linux (bash):**

```bash
# Install Deno first
curl -fsSL https://deno.land/install.sh | sh

# Install mcp-cli
deno install -g -A -n mcp jsr:@cosmic/mcp-cli

# Or download binary
curl -fsSL https://github.com/cosmic/mcp-cli/releases/latest/download/mcp-linux-x64 -o ~/.local/bin/mcp
chmod +x ~/.local/bin/mcp
```

## 9. Usage Examples with AI Assistants

### 9.1 Basic Pattern: Progressive Disclosure

**Works with: Claude (bash_tool), ChatGPT (code interpreter), any LLM with shell access**

```typescript
// User: "Read the README file and create a GitHub issue if there are TODOs"

// Step 1: Discovery - what servers are available? (minimal context)
const servers = await shell_exec('mcp servers list --names-only');
// Result: ["filesystem", "github", "slack", "jira"]
// Context cost: ~50 tokens

// Step 2: Check filesystem capabilities (still minimal)
const fsTools = await shell_exec('mcp tools list filesystem --names-only');
// Result: ["read_file", "write_file", "list_directory", "search_files"]
// Context cost: ~100 tokens

// Step 3: Load ONLY the schema we need
const readSchema = await shell_exec('mcp tools schema filesystem read_file');
// Result: Full JSON schema for read_file
// Context cost: ~200 tokens

// Step 4: Execute
const readme = await shell_exec(`mcp tools exec filesystem read_file --args '{"path": "README.md"}'`);
// Got the content, now check for TODOs...

// Step 5: If TODOs found, discover GitHub tools
if (hasTodos(readme)) {
  const githubTools = await shell_exec('mcp tools list github --names-only');
  // Result: ["create_issue", "get_issue", "list_issues", ...]
  // Context cost: ~150 tokens
  
  // Step 6: Load create_issue schema
  const createIssueSchema = await shell_exec('mcp tools schema github create_issue');
  // Context cost: ~300 tokens
  
  // Step 7: Create the issue
  await shell_exec(`mcp tools exec github create_issue --args '${JSON.stringify(issueData)}'`);
}

// Total context overhead: ~800 tokens for schemas
// vs. ~35,000 tokens if all tools loaded upfront
```

**Platform-Specific Execution:**

```python
# Claude (Python with bash_tool)
servers = bash_tool(command='mcp servers list --names-only')

# ChatGPT (Code Interpreter)
import subprocess
result = subprocess.run(['mcp', 'servers', 'list', '--names-only'], 
                       capture_output=True, text=True)
servers = json.loads(result.stdout)

# Custom Agent (JavaScript)
const { stdout } = await Deno.Command('mcp', {
  args: ['servers', 'list', '--names-only']
}).output();
const servers = JSON.parse(new TextDecoder().decode(stdout));
```

### 9.2 Advanced Pattern: Task-Based Discovery

```typescript
// User: "Help me debug why the CI is failing"

// Step 1: Search for relevant capabilities across servers
const search = await bash_tool('mcp-cli search "CI pipeline logs build status"');
// Result: {
//   "github": ["get_workflow_run", "list_workflow_runs"],
//   "ci-server": ["get_build_logs", "get_build_status"],
//   "slack": ["search_messages"]  # Maybe CI posts to Slack
// }
// Context cost: ~300 tokens

// Step 2: Inspect the most relevant server
const ciInfo = await bash_tool('mcp-cli inspect ci-server');
// Result: { "tools": 15, "resources": 3, "capabilities": ["streaming", "webhooks"] }
// Context cost: ~100 tokens

// Step 3: Get brief descriptions to choose the right tool
const ciTools = await bash_tool('mcp-cli tools list ci-server --brief');
// Result: [
//   {"name": "get_build_logs", "description": "Retrieve logs for a specific build"},
//   {"name": "get_build_status", "description": "Get current status of a build"},
//   ...
// ]
// Context cost: ~500 tokens

// Step 4: Load schemas for the 2-3 tools we'll actually use
const schemas = await bash_tool('mcp-cli tools schema ci-server get_build_logs get_build_status');
// Context cost: ~600 tokens

// Step 5: Execute
const status = await bash_tool(`mcp-cli tools exec ci-server get_build_status --args '{"build_id": "123"}'`);
const logs = await bash_tool(`mcp-cli tools exec ci-server get_build_logs --args '{"build_id": "123"}'`);

// Total: ~1,500 tokens vs loading all CI + GitHub + Slack tools (~15,000 tokens)
```

### 9.3 Batch Operations Pattern

```typescript
// User: "Set up a new feature branch: create branch, scaffold files, create PR"

// Step 1: Create batch operation file
const batchOps = {
  operations: [
    {
      server: "github",
      tool: "create_branch",
      args: { branch: "feature/new-feature", from: "main" },
      output_var: "branch_ref"
    },
    {
      server: "filesystem",
      tool: "create_directory",
      args: { path: "src/features/new-feature" }
    },
    {
      server: "filesystem",
      tool: "write_file",
      args: {
        path: "src/features/new-feature/index.ts",
        content: "// TODO: Implement feature"
      }
    },
    {
      server: "github",
      tool: "create_pull_request",
      args: {
        title: "Add new feature",
        head: "{{branch_ref}}",  // Reference from operation 1
        base: "main"
      }
    }
  ]
};

// Step 2: Execute batch (CLI loads schemas internally, doesn't pollute AI's context)
const result = await shell_exec(`mcp batch exec --file ${JSON.stringify(batchOps)}`);

// AI's context never sees individual tool schemas!
// Context cost: ~500 tokens (just the batch operation definition)
```

### 9.4 Exploration Pattern

```typescript
// User: "What can you help me with?"

// Show available servers without overwhelming with details
const servers = await shell_exec('mcp servers list --names-only');
// Result: ["filesystem", "github", "slack", "jira", "database"]

// Let user pick, then show high-level capabilities
const inspect = await shell_exec('mcp inspect github');
// Result: {
//   "tools": 28,
//   "resources": 5,
//   "prompts": 2,
//   "categories": ["repository", "issues", "pull-requests", "workflows"]
// }

// User shows interest in issues, drill down
const issueTools = await shell_exec('mcp tools search github "issue"');
// Result: ["create_issue", "get_issue", "update_issue", "list_issues", "add_labels"]

// User: "Show me how to create an issue"
const schema = await shell_exec('mcp tools schema github create_issue');
// NOW load the full schema

// Progressive disclosure: went from 28 tools (~8,400 tokens) to 1 tool (~300 tokens)
```

### 9.5 Context-Aware Workflow

```typescript
// AI can build up a "working set" of tools across a conversation

// Turn 1: "List files in the project"
const listSchema = await shell_exec('mcp tools schema filesystem list_directory');
const files = await shell_exec(`mcp tools exec filesystem list_directory --args '{"path": "."}'`);
// Context now has: list_directory schema

// Turn 2: "Read the package.json"
const readSchema = await shell_exec('mcp tools schema filesystem read_file');
const pkg = await shell_exec(`mcp tools exec filesystem read_file --args '{"path": "package.json"}'`);
// Context now has: list_directory + read_file schemas (2 tools, ~400 tokens)

// Turn 3: "Check if there's a CI workflow for this"
const ghSchema = await shell_exec('mcp tools schema github list_workflow_runs');
const workflows = await shell_exec(`mcp tools exec github list_workflow_runs --args {...}`);
// Context now has: 3 tool schemas (~700 tokens)

// Turn 10: Earlier tool schemas aged out of context naturally
// Working set remains small and relevant
// vs. 125 tools permanently loaded (~35,000 tokens)
```

### 9.6 Error Handling with Suggestions

```typescript
// User tries to use a tool that doesn't exist
const result = await shell_exec('mcp tools exec filesystem delete_everything --args {}');

// Error response helps AI recover:
{
  "success": false,
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "Tool 'delete_everything' not found on server 'filesystem'",
    "suggestion": "Try: mcp tools list filesystem --names-only",
    "similar": ["delete_file", "delete_directory"]
  }
}

// AI can self-correct:
const availableTools = await shell_exec('mcp tools list filesystem --names-only');
// Then pick the correct tool
```

### 9.7 Multi-Platform Usage

**Claude (via bash_tool):**
```python
result = bash_tool(command='mcp servers list --names-only')
```

**ChatGPT (Code Interpreter):**
```python
import subprocess
import json

result = subprocess.run(
    ['mcp', 'servers', 'list', '--names-only'],
    capture_output=True,
    text=True
)
servers = json.loads(result.stdout)['data']
```

**GitHub Copilot Agent:**
```javascript
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const { stdout } = await execAsync('mcp servers list --names-only');
const result = JSON.parse(stdout);
```

**Custom Python Agent:**
```python
import subprocess
import json

def mcp_exec(command: str) -> dict:
    result = subprocess.run(
        ['mcp'] + command.split(),
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

# Usage
servers = mcp_exec('servers list --names-only')
tools = mcp_exec('tools list filesystem --names-only')
```

## 10. Development Roadmap

### Phase 1: MVP - Progressive Disclosure Core (Week 1-2)
**Focus: Minimal context overhead from day one**

- [ ] Basic CLI structure with Commander.js
- [ ] Configuration file support
- [ ] Stdio transport implementation
- [ ] **Core progressive disclosure commands:**
  - [ ] `servers list --names-only`
  - [ ] `tools list <server> --names-only`
  - [ ] `tools schema <server> <tool>` (single tool only)
  - [ ] `tools exec <server> <tool>`
- [ ] JSON output formatting with token estimates
- [ ] Basic error handling with suggestions

**Success Criteria:**
- Can discover and execute tools with < 1,000 tokens overhead
- All list operations default to names-only
- Schema loading is explicit and targeted

### Phase 2: Discovery & Search (Week 3)
**Focus: Intelligent tool discovery without context pollution**

- [ ] SSE transport implementation
- [ ] HTTP transport implementation  
- [ ] **Advanced discovery commands:**
  - [ ] `search <query>` - cross-server search
  - [ ] `inspect <server>` - high-level capabilities
  - [ ] `tools list <server> --brief` - short descriptions
  - [ ] `recommend <task>` - suggest tools for tasks
- [ ] Resource and prompt operations (with same progressive disclosure)
- [ ] Response size management (pagination, truncation)

**Success Criteria:**
- Can explore 100+ tools while loading < 5 schemas
- Search results ranked by relevance
- Brief mode provides enough info to choose tools

### Phase 3: Workflow Optimization (Week 4)
**Focus: Support complex multi-tool workflows efficiently**

- [ ] **Batch operations:**
  - [ ] Execute multiple tools in sequence
  - [ ] Variable interpolation between steps
  - [ ] Transactional execution (rollback on failure)
- [ ] Schema caching (in-memory only)
- [ ] Streaming support for long-running operations
- [ ] Comprehensive error handling with recovery suggestions

**Success Criteria:**
- 5-step workflows use < 3,000 tokens in schemas
- Batch operations don't leak schemas to Claude's context
- Cache reduces redundant schema loads by 70%+

### Phase 4: Polish & Documentation (Week 5)
**Focus: Production readiness**

- [ ] Unit and integration tests (80%+ coverage)
- [ ] **Documentation focused on context management:**
  - [ ] "How Progressive Disclosure Works" guide
  - [ ] Token usage comparison examples
  - [ ] Best practices for Claude integration
- [ ] Performance optimization
- [ ] Security hardening (input validation, sandboxing)
- [ ] NPM package publishing

**Success Criteria:**
- All tests passing
- Documentation shows clear before/after token counts
- Security audit complete

### Phase 5: Advanced Features (Future)
**Focus: Enhanced capabilities without sacrificing context efficiency**

- [ ] Interactive mode (with explicit schema loading)
- [ ] Tool usage analytics (which tools used together?)
- [ ] Smart caching based on usage patterns
- [ ] Server health monitoring and auto-failover
- [ ] Plugin system for custom transports
- [ ] Claude-specific optimizations:
  - [ ] Auto-detect when schemas aged out of context
  - [ ] Suggest when to reload schemas
  - [ ] Token budget awareness

## 11. Success Metrics

### 11.1 Context Efficiency (Primary Goal)

- **Token Reduction:** Achieve 90%+ reduction in tool-related context usage
  - Baseline: 100 tools × 300 tokens avg = 30,000 tokens
  - Target: Average task uses < 3,000 tokens in tool schemas
- **Discovery Speed:** List operations complete in < 200ms
- **Schema Loading:** Individual tool schema loads in < 100ms
- **Zero Waste:** No tool schemas loaded that aren't executed within 3 turns

### 11.2 Functionality

- Successfully connect to and use 3+ different MCP servers
- Support all three transport types (stdio, SSE, HTTP)
- Handle 10+ concurrent tools across multiple servers
- Batch operations execute transactionally

### 11.3 Performance

- Startup time: < 500ms
- Command execution: < 2s for most operations
- Memory footprint: < 100MB under normal load
- Cache hit rate: > 70% for repeated schema loads

### 11.4 Usability

- Claude can use tool with minimal bash_tool calls
- Clear error messages with actionable suggestions
- Intuitive command structure (minimal documentation needed)
- Progressive disclosure feels natural in workflows

### 11.5 Reliability

- < 1% error rate under normal conditions
- Graceful degradation when servers unavailable
- Automatic retry with backoff for transient failures
- Connection pooling prevents resource exhaustion

## 12. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| MCP protocol changes | High | Medium | Follow official SDK updates, version pinning |
| Enterprise firewall blocks | High | Medium | Document network requirements, provide workarounds |
| Performance issues with many servers | Medium | Low | Implement connection pooling, lazy loading |
| Security vulnerabilities | High | Low | Regular security audits, input validation |
| Compatibility issues across platforms | Medium | Medium | Extensive cross-platform testing |

## 13. Open Questions

### 13.1 Context Management

1. **Schema Caching Strategy:** Should we cache loaded schemas in memory? For how long?
   - Pro: Reduces redundant loads within a session
   - Con: Might keep old schemas in AI's context longer than needed
   - Proposed: In-memory cache with 5-minute TTL, cleared between conversations

2. **Token Budget Awareness:** Should the CLI expose token usage metrics to help AI assistants manage their context budget?
   - Example: "This operation will add ~1,200 tokens to context"
   - AI could make informed decisions about what to load

3. **Auto-cleanup:** Should we provide a command for AI assistants to explicitly clear schema cache?
   - `mcp cache clear` when context gets too full?

### 13.2 Protocol & Compatibility

4. Should we support multiple MCP protocol versions simultaneously?
5. How to handle MCP server version compatibility checking?
6. What's the best way to handle long-running operations (streaming)?
   - Especially important to avoid keeping tools in context during long waits

### 13.3 Advanced Workflows

7. Should we implement a daemon mode for persistent connections?
   - Pro: Faster execution, connection pooling
   - Con: More complex, might not be needed with lazy loading

8. Should we support plugin architecture for custom transports?

9. **Discovery Strategies:** Should we implement "smart search" that learns which tools are commonly used together?
   - Example: If someone uses `github.create_issue`, they often need `github.add_labels` next
   - Could pre-suggest without loading schemas

### 13.4 AI Assistant Optimizations

10. Should we build platform-specific output adapters?
    - Detect which AI platform is calling (Claude, ChatGPT, etc.)
    - Optimize output formats for specific platform parsers
    - Provide conversation-scoped caching hints

11. **Progressive Schema Loading:** Should tool schemas support partial loading?
    - Load just the parameter names first
    - Load full descriptions/types only if requested
    - Could save another 50% of tokens in many cases

12. **Deno vs Node Runtime:** Should we optimize for one runtime or maintain full compatibility?
    - Primary development in Deno, testing in Node?
    - Or maintain feature parity across both?

## 14. Architecture Comparison

### 14.1 Alternative Approaches

#### Approach A: Direct MCP Integration (Eager Loading)
**How it works:** Load all tool definitions into LLM's native tool system

**Pros:**
- Native integration, no shell execution needed
- Faster execution (no subprocess calls)
- Better type safety and validation

**Cons:**
- ❌ **Critical flaw:** 35,000+ tokens of context pollution for large tool sets
- ❌ Attention mechanism degradation
- ❌ All-or-nothing: can't partially load tools
- ❌ Platform-specific: requires native MCP support

**Verdict:** Works for small tool sets (< 10 tools), **fails at scale**

#### Approach B: MCP Proxy Server (Server-Side Filtering)
**How it works:** Build a proxy that filters MCP tools before exposing to LLM

**Pros:**
- Can implement smart filtering logic
- Centralized control over what's exposed
- Reduces tokens sent to LLM

**Cons:**
- ❌ Still eager loading (proxy decides what to load, not LLM)
- ❌ Requires deploying and maintaining a server
- ❌ Static filtering rules don't adapt to dynamic task needs
- ❌ Adds network hop and latency

**Verdict:** Better than direct integration, but **still pollutes context with proxy's guess** at relevant tools

#### Approach C: MCP CLI Bridge (Lazy Loading) ✅
**How it works:** LLM discovers and loads tools on-demand via shell execution

**Pros:**
- ✅ **99% reduction in context pollution**
- ✅ LLM controls what's in context (true just-in-time loading)
- ✅ Scales to hundreds of tools effortlessly
- ✅ Works across any AI platform with shell access
- ✅ No server infrastructure needed
- ✅ Adapts to task requirements dynamically

**Cons:**
- Requires shell execution capability (which most platforms have)
- Need to parse JSON responses
- Not quite as "native" feeling
- Slight latency from subprocess calls

**Verdict:** **Correct architectural approach** for LLM tool systems at scale

### 14.2 Token Usage Comparison

**Scenario:** 5 MCP servers, 100 total tools, user asks to "read a file"

| Approach | Tokens Loaded | Tokens Used | Waste | Reasoning Quality |
|----------|--------------|-------------|-------|-------------------|
| Direct MCP (Eager) | 30,000 | 200 | 99.3% | Degraded |
| MCP Proxy (Filtered) | 5,000* | 200 | 96% | Somewhat degraded |
| CLI Bridge (Lazy) | 350 | 200 | 42%** | Optimal |

*Assumes proxy correctly guesses filesystem tools are relevant  
**Discovery overhead, but everything loaded gets used

### 14.3 Why Lazy Loading Is Correct

This isn't specific to MCP or any particular LLM—it's a fundamental principle:

**For any LLM + tools system:**
1. Context is precious (even with 200K windows)
2. Attention is quadratic and can't be zeroed out
3. Tool discovery should be cheap (names only)
4. Schema loading should be lazy (just-in-time)
5. Working set should be minimal (only current needs)

The CLI bridge implements these principles correctly. Direct integration violates #4 and #5.

### 14.4 When Direct Integration Makes Sense

There ARE scenarios where direct MCP integration is fine:

- **Small tool sets:** < 10 tools, all frequently used together
- **Focused domains:** All tools highly relevant to narrow task scope  
- **Embedded assistants:** Tools are part of the application's core function
- **Learning/tutorials:** Showing all available capabilities upfront

But for **general-purpose AI assistants with access to enterprise tools**, lazy loading is essential.

### 14.5 Platform Support Matrix

| Platform | Shell Access | CLI Support | Native MCP | Best Approach |
|----------|-------------|-------------|------------|---------------|
| Claude | ✅ bash_tool | ✅ | ❌ | CLI Bridge |
| ChatGPT | ✅ Code Interpreter | ✅ | ❌ | CLI Bridge |
| GitHub Copilot | ✅ Terminal | ✅ | ❌ | CLI Bridge |
| Custom Agents | ✅ subprocess | ✅ | Varies | CLI Bridge |
| Embedded LLMs | Varies | Varies | Varies | Depends |

## 15. References

**MCP Resources:**
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)

**Deno Resources:**
- [Deno Documentation](https://docs.deno.com)
- [Deno Standard Library](https://jsr.io/@std)
- [Cliffy CLI Framework](https://cliffy.io)
- [JSR (JavaScript Registry)](https://jsr.io)
- [Deno Compile Documentation](https://docs.deno.com/runtime/manual/tools/compiler)

**Related Research:**
- [Attention Mechanisms in Transformers](https://arxiv.org/abs/1706.03762)
- [Long Context Windows in LLMs](https://arxiv.org/abs/2309.16039)
- [Tool Use in Language Models](https://arxiv.org/abs/2302.04761)

**Community:**
- [GitHub Repository](https://github.com/cosmic/mcp-cli) (future)
- [Discord Community](https://discord.gg/cosmic) (future)

---

**Next Steps:**

1. ✅ Review and approve this specification
2. Set up project repository (`cosmic/mcp-cli` on GitHub)
3. Initialize Deno project with JSR configuration
4. Implement Phase 1: Progressive Disclosure Core
   - Focus on `--names-only` flags and explicit schema loading
   - Measure token usage in real scenarios
   - Target: 90%+ reduction in tool-related context
5. Create test harness that compares token usage: eager vs lazy loading
6. Write integration tests across multiple AI platforms:
   - Claude (via bash_tool)
   - ChatGPT (via code interpreter simulation)
   - Custom agent (via subprocess)
7. Document best practices for AI assistant workflows with concrete examples
8. Publish initial findings on context pollution and attention mechanisms
9. Release v1.0.0 to JSR
10. Create platform-specific installation guides

**Success Criteria Before v1.0:**
- Can demonstrate 90%+ token reduction in realistic workflows
- Command structure feels intuitive (minimal documentation needed to use)
- Error messages guide AI assistants toward correct usage patterns
- Works flawlessly on Windows, macOS, and Linux
- Comprehensive test coverage (>80%)
- Full API documentation with examples

**Questions or Feedback:**

This specification positions `@cosmic/mcp-cli` as the **architecturally correct approach** for LLM tool systems, not just a workaround. The focus on:

1. **Context efficiency** as the primary goal
2. **Platform agnostic design** for any AI assistant
3. **Deno runtime** for modern development experience
4. **Progressive disclosure** as a fundamental pattern

Makes this a reference implementation for how to properly integrate external tools with LLM systems at scale.

**Additional Resources to Create:**

- Blog post: "Why Eager Loading Breaks LLM Tool Systems" 
- Case study: Token usage analysis across 10 common workflows
- Integration guides for major AI platforms (Claude, ChatGPT, custom agents)
- Video tutorial: "Building Context-Efficient AI Workflows"
- Benchmark suite: Compare performance across different approach patterns
