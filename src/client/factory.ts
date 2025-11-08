/**
 * Factory for creating MCP clients based on transport type
 */

import type { ServerConfig } from '../types/config.js';
import type { MCPClientAdapter } from './base.js';
import { StdioMCPClient } from './stdio.js';
import { ConfigError } from '../utils/errors.js';

/**
 * Create an MCP client based on the server configuration
 */
export function createMCPClient(config: ServerConfig): MCPClientAdapter {
  switch (config.type) {
    case 'stdio':
      return new StdioMCPClient(config);
    case 'sse':
      throw new ConfigError('SSE transport not yet implemented');
    case 'http':
      throw new ConfigError('HTTP transport not yet implemented');
    default:
      throw new ConfigError(`Unsupported transport type: ${(config as ServerConfig).type}`);
  }
}
