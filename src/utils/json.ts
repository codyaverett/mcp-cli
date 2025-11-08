/**
 * JSON output formatting utilities
 */

import type { CommandResult } from '../types/commands.js';

/**
 * Format a successful command result
 */
export function formatSuccess<T>(
  data: T,
  metadata?: {
    server?: string;
    timestamp?: string;
    executionTime?: number;
  }
): string {
  const result: CommandResult<T> = {
    success: true,
    data,
    metadata: {
      timestamp: metadata?.timestamp || new Date().toISOString(),
      executionTime: metadata?.executionTime || 0,
      ...(metadata?.server && { server: metadata.server }),
    },
  };

  return JSON.stringify(result, null, 2);
}

/**
 * Format an error result
 */
export function formatError(
  error: Error | string,
  code?: string,
  details?: unknown
): string {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorCode = code || (typeof error !== 'string' ? error.name : 'ERROR');

  const errorObj: CommandResult['error'] = {
    code: errorCode,
    message: errorMessage,
  };

  if (details !== undefined) {
    errorObj.details = details;
  }

  const result: CommandResult = {
    success: false,
    error: errorObj,
  };

  return JSON.stringify(result, null, 2);
}

/**
 * Parse JSON input safely
 */
export function parseJsonInput(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(`Invalid JSON input: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
