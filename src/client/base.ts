import type {
  Prompt,
  PromptResult,
  Resource,
  ResourceContents,
  ServerInfo,
  Tool,
  ToolResult,
} from "../types/mcp.ts";

/**
 * Base interface for MCP client adapters
 * All transport implementations must implement this interface
 */
export interface MCPClientAdapter {
  /**
   * Connect to the MCP server
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the MCP server
   */
  disconnect(): Promise<void>;

  /**
   * Check if client is connected
   */
  isConnected(): boolean;

  /**
   * Get server information
   */
  getServerInfo(): Promise<ServerInfo>;

  /**
   * List available tools
   */
  listTools(): Promise<Tool[]>;

  /**
   * Get schema for specific tool
   */
  getTool(name: string): Promise<Tool | null>;

  /**
   * Execute a tool with arguments
   */
  executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;

  /**
   * List available resources
   */
  listResources(): Promise<Resource[]>;

  /**
   * Read a specific resource
   */
  readResource(uri: string): Promise<ResourceContents>;

  /**
   * Subscribe to resource updates (if supported)
   */
  subscribeToResource?(uri: string): Promise<void>;

  /**
   * Unsubscribe from resource updates (if supported)
   */
  unsubscribeFromResource?(uri: string): Promise<void>;

  /**
   * List available prompts
   */
  listPrompts(): Promise<Prompt[]>;

  /**
   * Get a specific prompt
   */
  getPrompt(name: string, args?: Record<string, string>): Promise<PromptResult>;

  /**
   * Set timeout for operations
   */
  setTimeout(timeout: number): void;

  /**
   * Get current timeout
   */
  getTimeout(): number;
}

/**
 * Base class with common functionality for MCP clients
 */
export abstract class BaseMCPClient implements MCPClientAdapter {
  protected connected = false;
  protected timeout = 30000; // 30 seconds default

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getServerInfo(): Promise<ServerInfo>;
  abstract listTools(): Promise<Tool[]>;
  abstract getTool(name: string): Promise<Tool | null>;
  abstract executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  abstract listResources(): Promise<Resource[]>;
  abstract readResource(uri: string): Promise<ResourceContents>;
  abstract listPrompts(): Promise<Prompt[]>;
  abstract getPrompt(name: string, args?: Record<string, string>): Promise<PromptResult>;

  isConnected(): boolean {
    return this.connected;
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  getTimeout(): number {
    return this.timeout;
  }

  /**
   * Ensure client is connected
   */
  protected ensureConnected(): void {
    if (!this.connected) {
      throw new Error("Client is not connected. Call connect() first.");
    }
  }

  /**
   * Create a timeout promise for async operations
   */
  protected createTimeoutPromise<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${this.timeout}ms`));
        }, this.timeout);
      }),
    ]);
  }
}
