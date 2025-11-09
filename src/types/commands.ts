import type { ErrorResponse } from "./errors.ts";

/**
 * Result size classification
 */
export type ResultSize = "small" | "medium" | "large";

/**
 * Response metadata
 */
export interface ResponseMetadata {
  server?: string;
  timestamp: string;
  executionTime: number;
  tokensEstimate?: number;
  resultSize?: ResultSize;
  truncated?: boolean;
}

/**
 * Success response structure
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  metadata?: ResponseMetadata;
}

/**
 * Generic response type (success or error)
 */
export type Response<T = unknown> = SuccessResponse<T> | ErrorResponse;

/**
 * List options (common across commands)
 */
export interface ListOptions {
  namesOnly?: boolean;
  brief?: boolean;
  full?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Server list options
 */
export interface ServerListOptions extends ListOptions {
  includeDisabled?: boolean;
}

/**
 * Tool list options
 */
export interface ToolListOptions extends ListOptions {
  category?: string;
}

/**
 * Search options
 */
export interface SearchOptions {
  query: string;
  server?: string;
  limit?: number;
}

/**
 * Tool execution options
 */
export interface ToolExecOptions {
  server: string;
  tool: string;
  args: Record<string, unknown>;
  stream?: boolean;
  maxTokens?: number;
}

/**
 * Resource read options
 */
export interface ResourceReadOptions {
  server: string;
  uri: string;
  maxTokens?: number;
}

/**
 * Prompt get options
 */
export interface PromptGetOptions {
  server: string;
  prompt: string;
  args?: Record<string, string>;
}

/**
 * Batch operation
 */
export interface BatchOperation {
  server: string;
  tool: string;
  args: Record<string, unknown>;
  outputVar?: string;
}

/**
 * Batch execution options
 */
export interface BatchExecOptions {
  operations: BatchOperation[];
  transactional?: boolean;
}

/**
 * Server add options
 */
export interface ServerAddOptions {
  name: string;
  type: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  url?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  enabled?: boolean;
}

/**
 * Search result
 */
export interface SearchResult {
  [serverName: string]: string[];
}

/**
 * Recommendation result
 */
export interface RecommendationResult {
  tools: Array<{
    server: string;
    tool: string;
    description?: string;
    confidence: number;
  }>;
}
