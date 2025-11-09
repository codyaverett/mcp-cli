/**
 * @module mcp-cli
 * @description MCP CLI Bridge - Progressive disclosure CLI for Model Context Protocol servers
 *
 * This module exports all major components for programmatic use.
 * For CLI usage, use `src/cli.ts` directly.
 */

// Export CLI
export { cli } from "./cli.ts";

// Export types
export type * from "./types/config.ts";
export type * from "./types/mcp.ts";
export type * from "./types/commands.ts";
export type * from "./types/errors.ts";

// Export errors
export { ErrorCode, MCPError } from "./types/errors.ts";

// Export config
export { ConfigLoader, configLoader } from "./config/loader.ts";
export { ConfigValidator } from "./config/validator.ts";
export * from "./config/schema.ts";

// Export client
export type { MCPClientAdapter } from "./client/base.ts";
export { BaseMCPClient } from "./client/base.ts";
export { StdioMCPClient } from "./client/stdio.ts";
export { SSEMCPClient } from "./client/sse.ts";
export { HTTPMCPClient } from "./client/http.ts";
export { MCPClientFactory, MCPClientPool, clientPool } from "./client/factory.ts";

// Export utilities
export { Platform } from "./utils/platform.ts";
export { Logger, logger } from "./utils/logger.ts";
export { JSONFormatter } from "./utils/json.ts";
export { Errors } from "./utils/errors.ts";

// Export commands (for advanced usage)
export * as ServersCommands from "./commands/servers.ts";
export * as ToolsCommands from "./commands/tools.ts";
export * as ResourcesCommands from "./commands/resources.ts";
export * as PromptsCommands from "./commands/prompts.ts";
export * as SearchCommands from "./commands/search.ts";
