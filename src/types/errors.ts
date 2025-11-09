/**
 * Error codes for MCP CLI operations
 */
export enum ErrorCode {
  // Configuration errors
  CONFIG_NOT_FOUND = "CONFIG_NOT_FOUND",
  CONFIG_INVALID = "CONFIG_INVALID",
  CONFIG_PARSE_ERROR = "CONFIG_PARSE_ERROR",

  // Server errors
  SERVER_NOT_FOUND = "SERVER_NOT_FOUND",
  SERVER_ALREADY_EXISTS = "SERVER_ALREADY_EXISTS",
  SERVER_CONNECTION_FAILED = "SERVER_CONNECTION_FAILED",
  SERVER_TIMEOUT = "SERVER_TIMEOUT",
  SERVER_DISABLED = "SERVER_DISABLED",

  // Tool errors
  TOOL_NOT_FOUND = "TOOL_NOT_FOUND",
  TOOL_EXECUTION_FAILED = "TOOL_EXECUTION_FAILED",
  TOOL_INVALID_ARGS = "TOOL_INVALID_ARGS",
  TOOL_SCHEMA_ERROR = "TOOL_SCHEMA_ERROR",

  // Resource errors
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  RESOURCE_READ_FAILED = "RESOURCE_READ_FAILED",
  RESOURCE_INVALID_URI = "RESOURCE_INVALID_URI",

  // Prompt errors
  PROMPT_NOT_FOUND = "PROMPT_NOT_FOUND",
  PROMPT_INVALID_ARGS = "PROMPT_INVALID_ARGS",

  // Transport errors
  TRANSPORT_NOT_SUPPORTED = "TRANSPORT_NOT_SUPPORTED",
  TRANSPORT_ERROR = "TRANSPORT_ERROR",

  // Validation errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_JSON = "INVALID_JSON",

  // General errors
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  OPERATION_CANCELLED = "OPERATION_CANCELLED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
}

/**
 * Error details structure
 */
export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  suggestion?: string;
  similar?: string[];
  cause?: Error;
}

/**
 * Custom error class for MCP CLI operations
 */
export class MCPError extends Error {
  code: ErrorCode;
  details?: Record<string, unknown>;
  suggestion?: string;
  similar?: string[];
  override cause?: Error;

  constructor(options: ErrorDetails) {
    super(options.message);
    this.name = "MCPError";
    this.code = options.code;
    this.details = options.details;
    this.suggestion = options.suggestion;
    this.similar = options.similar;
    this.cause = options.cause;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPError);
    }
  }

  /**
   * Convert error to JSON response format
   */
  toJSON(): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        suggestion: this.suggestion,
        similar: this.similar,
      },
    };
  }
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    suggestion?: string;
    similar?: string[];
  };
}
