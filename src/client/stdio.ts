/**
 * Stdio transport implementation for MCP client
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { StdioServerConfig } from '../types/config.js';
import type { Tool, Resource, ResourceContent, Prompt, PromptMessage } from '../types/mcp.js';
import { BaseMCPClient } from './base.js';
import { ConnectionError, MCPError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * MCP Client implementation using stdio transport
 */
export class StdioMCPClient extends BaseMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  constructor(private config: StdioServerConfig) {
    super();
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      logger.debug('Connecting to stdio MCP server', {
        command: this.config.command,
        args: this.config.args,
      });

      // Create stdio transport
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args || [],
        env: this.config.env,
      });

      // Create client
      this.client = new Client(
        {
          name: 'mcp-cli',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect to the server
      await this.client.connect(this.transport);

      this.connected = true;
      logger.debug('Successfully connected to MCP server');
    } catch (error) {
      throw new ConnectionError(
        `Failed to connect to stdio server: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error }
      );
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.client) {
      return;
    }

    try {
      logger.debug('Disconnecting from MCP server');
      await this.client.close();
      this.client = null;
      this.transport = null;
      this.connected = false;
      logger.debug('Successfully disconnected from MCP server');
    } catch (error) {
      logger.error('Error disconnecting from MCP server', { error });
      throw new ConnectionError(
        `Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error }
      );
    }
  }

  async listTools(): Promise<Tool[]> {
    this.ensureConnected();
    if (!this.client) {
      throw new ConnectionError('Client not initialized');
    }

    try {
      logger.debug('Listing tools from MCP server');
      const response = await this.client.listTools();

      return response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Tool['inputSchema'],
      }));
    } catch (error) {
      throw new MCPError(
        `Failed to list tools: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_TOOLS_ERROR',
        { error }
      );
    }
  }

  async executeTool(name: string, args: unknown): Promise<unknown> {
    this.ensureConnected();
    if (!this.client) {
      throw new ConnectionError('Client not initialized');
    }

    try {
      logger.debug('Executing tool', { name, args });
      const response = await this.client.callTool({
        name,
        arguments: args as Record<string, unknown>,
      });

      return response.content;
    } catch (error) {
      throw new MCPError(
        `Failed to execute tool "${name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXECUTE_TOOL_ERROR',
        { tool: name, args, error }
      );
    }
  }

  async listResources(): Promise<Resource[]> {
    this.ensureConnected();
    if (!this.client) {
      throw new ConnectionError('Client not initialized');
    }

    try {
      logger.debug('Listing resources from MCP server');
      const response = await this.client.listResources();

      return response.resources.map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      }));
    } catch (error) {
      throw new MCPError(
        `Failed to list resources: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_RESOURCES_ERROR',
        { error }
      );
    }
  }

  async readResource(uri: string): Promise<ResourceContent> {
    this.ensureConnected();
    if (!this.client) {
      throw new ConnectionError('Client not initialized');
    }

    try {
      logger.debug('Reading resource', { uri });
      const response = await this.client.readResource({ uri });

      if (response.contents.length === 0) {
        throw new MCPError(`Resource "${uri}" returned no content`, 'EMPTY_RESOURCE');
      }

      const content = response.contents[0];

      return {
        uri,
        mimeType: content.mimeType,
        text: 'text' in content ? String(content.text) : undefined,
        blob: 'blob' in content ? String(content.blob) : undefined,
      };
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      throw new MCPError(
        `Failed to read resource "${uri}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        'READ_RESOURCE_ERROR',
        { uri, error }
      );
    }
  }

  async listPrompts(): Promise<Prompt[]> {
    this.ensureConnected();
    if (!this.client) {
      throw new ConnectionError('Client not initialized');
    }

    try {
      logger.debug('Listing prompts from MCP server');
      const response = await this.client.listPrompts();

      return response.prompts.map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
      }));
    } catch (error) {
      throw new MCPError(
        `Failed to list prompts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_PROMPTS_ERROR',
        { error }
      );
    }
  }

  async getPrompt(name: string, args: Record<string, string>): Promise<PromptMessage[]> {
    this.ensureConnected();
    if (!this.client) {
      throw new ConnectionError('Client not initialized');
    }

    try {
      logger.debug('Getting prompt', { name, args });
      const response = await this.client.getPrompt({
        name,
        arguments: args,
      });

      return response.messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content as PromptMessage['content'],
      }));
    } catch (error) {
      throw new MCPError(
        `Failed to get prompt "${name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_PROMPT_ERROR',
        { prompt: name, args, error }
      );
    }
  }
}
