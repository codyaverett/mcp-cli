import { ErrorCode, MCPError } from "../types/errors.ts";

/**
 * Error utility functions for creating user-friendly errors
 */
export class Errors {
  /**
   * Create a config not found error
   */
  static configNotFound(path: string): MCPError {
    return new MCPError({
      code: ErrorCode.CONFIG_NOT_FOUND,
      message: `Configuration file not found at: ${path}`,
      suggestion: "Run 'mcp servers add' to create your first server configuration",
    });
  }

  /**
   * Create a config parse error
   */
  static configParseError(path: string, cause?: Error): MCPError {
    return new MCPError({
      code: ErrorCode.CONFIG_PARSE_ERROR,
      message: `Failed to parse configuration file: ${path}`,
      cause,
      suggestion: "Check that the config file is valid JSON",
    });
  }

  /**
   * Create a server not found error
   */
  static serverNotFound(serverName: string, availableServers?: string[]): MCPError {
    let suggestion: string;

    if (!availableServers || availableServers.length === 0) {
      suggestion = "No servers configured. Run 'mcp servers init' then 'mcp servers add <name> --type stdio --command <cmd>' to add your first server";
    } else {
      suggestion = `Available servers: ${availableServers.join(", ")}`;
    }

    return new MCPError({
      code: ErrorCode.SERVER_NOT_FOUND,
      message: `Server '${serverName}' not found in configuration`,
      similar: availableServers,
      suggestion,
    });
  }

  /**
   * Create a server already exists error
   */
  static serverAlreadyExists(serverName: string): MCPError {
    return new MCPError({
      code: ErrorCode.SERVER_ALREADY_EXISTS,
      message: `Server '${serverName}' already exists in configuration`,
      suggestion: "Use a different name or remove the existing server first",
    });
  }

  /**
   * Create a server connection failed error
   */
  static serverConnectionFailed(
    serverName: string,
    reason?: string,
    cause?: Error,
  ): MCPError {
    return new MCPError({
      code: ErrorCode.SERVER_CONNECTION_FAILED,
      message: `Failed to connect to server '${serverName}'${reason ? `: ${reason}` : ""}`,
      cause,
      suggestion: "Check server configuration and ensure the server is running",
    });
  }

  /**
   * Create a server timeout error
   */
  static serverTimeout(serverName: string, timeout: number): MCPError {
    return new MCPError({
      code: ErrorCode.SERVER_TIMEOUT,
      message: `Connection to server '${serverName}' timed out after ${timeout}ms`,
      suggestion: "Try increasing the timeout in server configuration",
    });
  }

  /**
   * Create a server disabled error
   */
  static serverDisabled(serverName: string): MCPError {
    return new MCPError({
      code: ErrorCode.SERVER_DISABLED,
      message: `Server '${serverName}' is disabled`,
      suggestion: "Enable the server in configuration or use a different server",
    });
  }

  /**
   * Create a tool not found error
   */
  static toolNotFound(
    toolName: string,
    serverName: string,
    availableTools?: string[],
  ): MCPError {
    // Find similar tool names (simple string similarity)
    const similar = availableTools?.filter((name) =>
      name.toLowerCase().includes(toolName.toLowerCase()) ||
      toolName.toLowerCase().includes(name.toLowerCase())
    );

    return new MCPError({
      code: ErrorCode.TOOL_NOT_FOUND,
      message: `Tool '${toolName}' not found on server '${serverName}'`,
      similar,
      suggestion: `Try: mcp tools list ${serverName} --names-only`,
    });
  }

  /**
   * Create a tool execution failed error
   */
  static toolExecutionFailed(
    toolName: string,
    serverName: string,
    reason?: string,
    cause?: Error,
  ): MCPError {
    return new MCPError({
      code: ErrorCode.TOOL_EXECUTION_FAILED,
      message: `Tool '${toolName}' on server '${serverName}' failed${
        reason ? `: ${reason}` : ""
      }`,
      cause,
    });
  }

  /**
   * Create a tool invalid args error
   */
  static toolInvalidArgs(
    toolName: string,
    serverName: string,
    validationError?: string,
  ): MCPError {
    return new MCPError({
      code: ErrorCode.TOOL_INVALID_ARGS,
      message: `Invalid arguments for tool '${toolName}' on server '${serverName}'${
        validationError ? `: ${validationError}` : ""
      }`,
      suggestion: `Run 'mcp tools schema ${serverName} ${toolName}' to see required arguments`,
    });
  }

  /**
   * Create a resource not found error
   */
  static resourceNotFound(uri: string, serverName: string): MCPError {
    return new MCPError({
      code: ErrorCode.RESOURCE_NOT_FOUND,
      message: `Resource '${uri}' not found on server '${serverName}'`,
      suggestion: `Try: mcp resources list ${serverName}`,
    });
  }

  /**
   * Create a prompt not found error
   */
  static promptNotFound(
    promptName: string,
    serverName: string,
    availablePrompts?: string[],
  ): MCPError {
    return new MCPError({
      code: ErrorCode.PROMPT_NOT_FOUND,
      message: `Prompt '${promptName}' not found on server '${serverName}'`,
      similar: availablePrompts,
      suggestion: `Try: mcp prompts list ${serverName}`,
    });
  }

  /**
   * Create a validation error
   */
  static validationError(message: string, details?: Record<string, unknown>): MCPError {
    return new MCPError({
      code: ErrorCode.VALIDATION_ERROR,
      message,
      details,
    });
  }

  /**
   * Create an invalid JSON error
   */
  static invalidJSON(jsonString: string, cause?: Error): MCPError {
    return new MCPError({
      code: ErrorCode.INVALID_JSON,
      message: "Invalid JSON provided",
      details: { input: jsonString.slice(0, 100) },
      cause,
      suggestion: "Ensure the JSON is properly formatted",
    });
  }

  /**
   * Create a transport not supported error
   */
  static transportNotSupported(transport: string): MCPError {
    return new MCPError({
      code: ErrorCode.TRANSPORT_NOT_SUPPORTED,
      message: `Transport type '${transport}' is not supported`,
      suggestion: "Supported transports: stdio, sse, http",
    });
  }

  /**
   * Create a permission denied error
   */
  static permissionDenied(resource: string, action: string): MCPError {
    return new MCPError({
      code: ErrorCode.PERMISSION_DENIED,
      message: `Permission denied: cannot ${action} ${resource}`,
      suggestion: "Check file permissions or run with appropriate privileges",
    });
  }

  /**
   * Create an unknown error
   */
  static unknown(message: string, cause?: Error): MCPError {
    return new MCPError({
      code: ErrorCode.UNKNOWN_ERROR,
      message,
      cause,
    });
  }

  /**
   * Wrap any error as MCPError
   */
  static wrap(error: unknown): MCPError {
    if (error instanceof MCPError) {
      return error;
    }

    if (error instanceof Error) {
      return this.unknown(error.message, error);
    }

    return this.unknown(String(error));
  }
}
