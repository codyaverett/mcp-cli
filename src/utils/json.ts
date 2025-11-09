import type { Response, ResponseMetadata, ResultSize, SuccessResponse } from "../types/commands.ts";
import type { ErrorResponse } from "../types/errors.ts";

/**
 * JSON formatting and response utilities
 */
export class JSONFormatter {
  /**
   * Create a success response
   */
  static success<T>(
    data: T,
    metadata?: Partial<ResponseMetadata>,
  ): SuccessResponse<T> {
    const response: SuccessResponse<T> = {
      success: true,
      data,
    };

    if (metadata) {
      response.metadata = {
        timestamp: new Date().toISOString(),
        executionTime: 0,
        ...metadata,
      };
    }

    return response;
  }

  /**
   * Create an error response
   */
  static error(errorResponse: ErrorResponse): ErrorResponse {
    return errorResponse;
  }

  /**
   * Output response to stdout as JSON
   */
  static output(response: Response): void {
    const json = JSON.stringify(response, null, 2);
    console.log(json);
  }

  /**
   * Estimate token count for text
   * Simple heuristic: ~4 characters per token on average
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate token count for object (converts to JSON first)
   */
  static estimateTokensForObject(obj: unknown): number {
    const json = JSON.stringify(obj);
    return this.estimateTokens(json);
  }

  /**
   * Classify result size based on token estimate
   */
  static classifyResultSize(tokens: number): ResultSize {
    if (tokens < 500) return "small";
    if (tokens < 2000) return "medium";
    return "large";
  }

  /**
   * Truncate text to maximum token count
   */
  static truncateToTokens(text: string, maxTokens: number): {
    text: string;
    truncated: boolean;
  } {
    const maxChars = maxTokens * 4; // Rough estimate

    if (text.length <= maxChars) {
      return { text, truncated: false };
    }

    return {
      text: text.slice(0, maxChars) + "\n...[truncated]",
      truncated: true,
    };
  }

  /**
   * Add metadata to response with token estimates
   */
  static withMetadata<T>(
    data: T,
    server?: string,
    executionTime?: number,
  ): SuccessResponse<T> {
    const tokensEstimate = this.estimateTokensForObject(data);
    const resultSize = this.classifyResultSize(tokensEstimate);

    return this.success(data, {
      server,
      timestamp: new Date().toISOString(),
      executionTime: executionTime || 0,
      tokensEstimate,
      resultSize,
    });
  }

  /**
   * Pretty print JSON for debugging
   */
  static prettyPrint(obj: unknown): string {
    return JSON.stringify(obj, null, 2);
  }

  /**
   * Parse JSON with error handling
   */
  static parse<T = unknown>(json: string): T {
    try {
      return JSON.parse(json) as T;
    } catch (error) {
      throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Safe JSON stringify that handles circular references
   */
  static safeStringify(obj: unknown, indent = 2): string {
    const seen = new WeakSet();
    return JSON.stringify(
      obj,
      (_key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return "[Circular]";
          }
          seen.add(value);
        }
        return value;
      },
      indent,
    );
  }
}
