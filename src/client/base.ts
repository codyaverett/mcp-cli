/**
 * MCP Client abstraction layer
 */

import type { Tool, Resource, ResourceContent, Prompt, PromptMessage } from '../types/mcp.js';

/**
 * Abstract interface for MCP client implementations
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
   * Check if the client is connected
   */
  isConnected(): boolean;

  /**
   * List available tools from the server
   */
  listTools(): Promise<Tool[]>;

  /**
   * Execute a tool with the given arguments
   */
  executeTool(name: string, args: unknown): Promise<unknown>;

  /**
   * List available resources from the server
   */
  listResources(): Promise<Resource[]>;

  /**
   * Read a resource by URI
   */
  readResource(uri: string): Promise<ResourceContent>;

  /**
   * List available prompts from the server
   */
  listPrompts(): Promise<Prompt[]>;

  /**
   * Get a prompt with arguments
   */
  getPrompt(name: string, args: Record<string, string>): Promise<PromptMessage[]>;
}

/**
 * Base class for MCP client implementations
 */
export abstract class BaseMCPClient implements MCPClientAdapter {
  protected connected = false;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract listTools(): Promise<Tool[]>;
  abstract executeTool(name: string, args: unknown): Promise<unknown>;
  abstract listResources(): Promise<Resource[]>;
  abstract readResource(uri: string): Promise<ResourceContent>;
  abstract listPrompts(): Promise<Prompt[]>;
  abstract getPrompt(name: string, args: Record<string, string>): Promise<PromptMessage[]>;

  isConnected(): boolean {
    return this.connected;
  }

  protected ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Client not connected. Call connect() first.');
    }
  }
}
