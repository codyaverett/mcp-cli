/**
 * Configuration types for MCP CLI Bridge
 */

export type TransportType = 'stdio' | 'sse' | 'http';

export interface StdioServerConfig {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface SSEServerConfig {
  type: 'sse';
  url: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

export interface HTTPServerConfig {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

export type ServerConfig = StdioServerConfig | SSEServerConfig | HTTPServerConfig;

export interface Preferences {
  defaultTimeout?: number;
  maxRetries?: number;
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

export interface Config {
  servers: Record<string, ServerConfig>;
  preferences?: Preferences;
}

export const DEFAULT_PREFERENCES: Required<Preferences> = {
  defaultTimeout: 30000,
  maxRetries: 3,
  logLevel: 'info',
};
