/**
 * Command types and interfaces
 */

export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    server?: string;
    timestamp: string;
    executionTime: number;
  };
}

export interface ToolExecutionArgs {
  server: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface ResourceReadArgs {
  server: string;
  uri: string;
}

export interface PromptGetArgs {
  server: string;
  prompt: string;
  args: Record<string, string>;
}
