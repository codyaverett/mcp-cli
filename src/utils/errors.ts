/**
 * Custom error classes
 */

export class MCPError extends Error {
  constructor(
    message: string,
    public code: string = 'MCP_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class ConfigError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigError';
  }
}

export class ConnectionError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

export class ValidationError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'TIMEOUT_ERROR', details);
    this.name = 'TimeoutError';
  }
}

export class ServerNotFoundError extends MCPError {
  constructor(serverName: string) {
    super(`Server "${serverName}" not found in configuration`, 'SERVER_NOT_FOUND', { serverName });
    this.name = 'ServerNotFoundError';
  }
}

export class ToolNotFoundError extends MCPError {
  constructor(toolName: string, serverName: string) {
    super(`Tool "${toolName}" not found on server "${serverName}"`, 'TOOL_NOT_FOUND', { toolName, serverName });
    this.name = 'ToolNotFoundError';
  }
}
