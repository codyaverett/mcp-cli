import type {
  MCPClientAdapter,
} from "../../src/client/base.ts";
import type {
  Prompt,
  PromptResult,
  Resource,
  ResourceContents,
  ServerInfo,
  Tool,
  ToolResult,
} from "../../src/types/mcp.ts";

/**
 * Mock MCP client for testing
 * Allows configuring responses for different operations
 */
export class MockMCPClient implements MCPClientAdapter {
  private connected = false;
  private timeout = 30000;
  private connectDelay = 0;
  private disconnectDelay = 0;

  // Mock data
  private mockServerInfo: ServerInfo | null = null;
  private mockTools: Tool[] = [];
  private mockResources: Resource[] = [];
  private mockPrompts: Prompt[] = [];
  private mockToolResults: Map<string, ToolResult> = new Map();
  private mockResourceContents: Map<string, ResourceContents> = new Map();
  private mockPromptResults: Map<string, PromptResult> = new Map();

  // Error simulation
  private shouldFailConnect = false;
  private shouldFailDisconnect = false;
  private shouldTimeout = false;
  private errorOnOperation: string | null = null;

  // Call tracking
  public connectCalls = 0;
  public disconnectCalls = 0;
  public getServerInfoCalls = 0;
  public listToolsCalls = 0;
  public getToolCalls = 0;
  public executeToolCalls = 0;
  public listResourcesCalls = 0;
  public readResourceCalls = 0;
  public listPromptsCalls = 0;
  public getPromptCalls = 0;

  // Configuration methods
  setServerInfo(info: ServerInfo): void {
    this.mockServerInfo = info;
  }

  setTools(tools: Tool[]): void {
    this.mockTools = tools;
  }

  setResources(resources: Resource[]): void {
    this.mockResources = resources;
  }

  setPrompts(prompts: Prompt[]): void {
    this.mockPrompts = prompts;
  }

  setToolResult(toolName: string, result: ToolResult): void {
    this.mockToolResults.set(toolName, result);
  }

  setResourceContents(uri: string, contents: ResourceContents): void {
    this.mockResourceContents.set(uri, contents);
  }

  setPromptResult(promptName: string, result: PromptResult): void {
    this.mockPromptResults.set(promptName, result);
  }

  setConnectDelay(ms: number): void {
    this.connectDelay = ms;
  }

  setDisconnectDelay(ms: number): void {
    this.disconnectDelay = ms;
  }

  setShouldFailConnect(shouldFail: boolean): void {
    this.shouldFailConnect = shouldFail;
  }

  setShouldFailDisconnect(shouldFail: boolean): void {
    this.shouldFailDisconnect = shouldFail;
  }

  setShouldTimeout(shouldTimeout: boolean): void {
    this.shouldTimeout = shouldTimeout;
  }

  setErrorOnOperation(operation: string | null): void {
    this.errorOnOperation = operation;
  }

  // Reset tracking
  resetCallCounts(): void {
    this.connectCalls = 0;
    this.disconnectCalls = 0;
    this.getServerInfoCalls = 0;
    this.listToolsCalls = 0;
    this.getToolCalls = 0;
    this.executeToolCalls = 0;
    this.listResourcesCalls = 0;
    this.readResourceCalls = 0;
    this.listPromptsCalls = 0;
    this.getPromptCalls = 0;
  }

  // MCPClientAdapter implementation
  async connect(): Promise<void> {
    this.connectCalls++;

    if (this.connectDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.connectDelay));
    }

    if (this.shouldTimeout) {
      await new Promise((resolve) => setTimeout(resolve, this.timeout + 1000));
    }

    if (this.shouldFailConnect) {
      throw new Error("Mock connection failed");
    }

    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.disconnectCalls++;

    if (this.disconnectDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.disconnectDelay));
    }

    if (this.shouldFailDisconnect) {
      throw new Error("Mock disconnection failed");
    }

    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getServerInfo(): Promise<ServerInfo> {
    this.getServerInfoCalls++;

    if (!this.connected) {
      throw new Error("Client is not connected");
    }

    if (this.errorOnOperation === "getServerInfo") {
      throw new Error("Mock getServerInfo error");
    }

    if (!this.mockServerInfo) {
      throw new Error("Mock server info not configured");
    }

    return this.mockServerInfo;
  }

  async listTools(): Promise<Tool[]> {
    this.listToolsCalls++;

    if (!this.connected) {
      throw new Error("Client is not connected");
    }

    if (this.errorOnOperation === "listTools") {
      throw new Error("Mock listTools error");
    }

    return this.mockTools;
  }

  async getTool(name: string): Promise<Tool | null> {
    this.getToolCalls++;

    if (!this.connected) {
      throw new Error("Client is not connected");
    }

    if (this.errorOnOperation === "getTool") {
      throw new Error("Mock getTool error");
    }

    return this.mockTools.find((t) => t.name === name) || null;
  }

  async executeTool(name: string, _args: Record<string, unknown>): Promise<ToolResult> {
    this.executeToolCalls++;

    if (!this.connected) {
      throw new Error("Client is not connected");
    }

    if (this.errorOnOperation === "executeTool") {
      throw new Error("Mock executeTool error");
    }

    const result = this.mockToolResults.get(name);
    if (!result) {
      throw new Error(`Tool result not configured for: ${name}`);
    }

    return result;
  }

  async listResources(): Promise<Resource[]> {
    this.listResourcesCalls++;

    if (!this.connected) {
      throw new Error("Client is not connected");
    }

    if (this.errorOnOperation === "listResources") {
      throw new Error("Mock listResources error");
    }

    return this.mockResources;
  }

  async readResource(uri: string): Promise<ResourceContents> {
    this.readResourceCalls++;

    if (!this.connected) {
      throw new Error("Client is not connected");
    }

    if (this.errorOnOperation === "readResource") {
      throw new Error("Mock readResource error");
    }

    const contents = this.mockResourceContents.get(uri);
    if (!contents) {
      throw new Error(`Resource contents not configured for: ${uri}`);
    }

    return contents;
  }

  async listPrompts(): Promise<Prompt[]> {
    this.listPromptsCalls++;

    if (!this.connected) {
      throw new Error("Client is not connected");
    }

    if (this.errorOnOperation === "listPrompts") {
      throw new Error("Mock listPrompts error");
    }

    return this.mockPrompts;
  }

  async getPrompt(name: string, _args?: Record<string, string>): Promise<PromptResult> {
    this.getPromptCalls++;

    if (!this.connected) {
      throw new Error("Client is not connected");
    }

    if (this.errorOnOperation === "getPrompt") {
      throw new Error("Mock getPrompt error");
    }

    const result = this.mockPromptResults.get(name);
    if (!result) {
      throw new Error(`Prompt result not configured for: ${name}`);
    }

    return result;
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  getTimeout(): number {
    return this.timeout;
  }
}
