/**
 * Transport types for MCP connections
 */
export type TransportType = "stdio" | "sse" | "http";

/**
 * Base server configuration
 */
export interface BaseServerConfig {
  type: TransportType;
  enabled?: boolean;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Stdio transport configuration
 */
export interface StdioServerConfig extends BaseServerConfig {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/**
 * SSE (Server-Sent Events) transport configuration
 */
export interface SSEServerConfig extends BaseServerConfig {
  type: "sse";
  url: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

/**
 * HTTP transport configuration
 */
export interface HTTPServerConfig extends BaseServerConfig {
  type: "http";
  url: string;
  apiKey?: string;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
}

/**
 * Union type for all server configurations
 */
export type ServerConfig = StdioServerConfig | SSEServerConfig | HTTPServerConfig;

/**
 * User preferences
 */
export interface Preferences {
  defaultTimeout?: number;
  maxRetries?: number;
  logLevel?: LogLevel;
  cacheSchemas?: boolean;
  cacheTTL?: number;
}

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

/**
 * Complete configuration structure
 */
export interface Config {
  servers: Record<string, ServerConfig>;
  preferences?: Preferences;
}

/**
 * Server connection status
 */
export interface ServerStatus {
  name: string;
  connected: boolean;
  enabled: boolean;
  type: TransportType;
  lastError?: string;
  capabilities?: ServerCapabilities;
}

/**
 * Server capabilities
 */
export interface ServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  experimental?: Record<string, unknown>;
}

/**
 * Environment variable substitution pattern
 */
export const ENV_VAR_PATTERN = /\$\{([^}]+)\}/g;
