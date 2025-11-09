import { assertEquals, assertExists } from "@std/assert";
import { BaseMCPClient } from "../../../src/client/base.ts";
import type {
  Prompt,
  PromptResult,
  Resource,
  ResourceContents,
  ServerInfo,
  Tool,
  ToolResult,
} from "../../../src/types/mcp.ts";
import { assertThrowsAsync } from "../../fixtures/test-utils.ts";
import {
  createMinimalServerInfo,
  createPrompt,
  createPromptResult,
  createResource,
  createResourceContents,
  createSimpleTool,
  createTextToolResult,
} from "../../fixtures/test-data.ts";

/**
 * Concrete implementation of BaseMCPClient for testing
 */
class TestMCPClient extends BaseMCPClient {
  private mockServerInfo: ServerInfo = createMinimalServerInfo("test");
  private mockTools: Tool[] = [];
  private mockResources: Resource[] = [];
  private mockPrompts: Prompt[] = [];
  private shouldThrowOnConnect = false;
  private shouldThrowOnOperation = false;
  private connectDelay = 0;

  setMockServerInfo(info: ServerInfo): void {
    this.mockServerInfo = info;
  }

  setMockTools(tools: Tool[]): void {
    this.mockTools = tools;
  }

  setMockResources(resources: Resource[]): void {
    this.mockResources = resources;
  }

  setMockPrompts(prompts: Prompt[]): void {
    this.mockPrompts = prompts;
  }

  setShouldThrowOnConnect(should: boolean): void {
    this.shouldThrowOnConnect = should;
  }

  setShouldThrowOnOperation(should: boolean): void {
    this.shouldThrowOnOperation = should;
  }

  setConnectDelay(ms: number): void {
    this.connectDelay = ms;
  }

  async connect(): Promise<void> {
    if (this.connectDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.connectDelay));
    }

    if (this.shouldThrowOnConnect) {
      throw new Error("Connection failed");
    }

    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getServerInfo(): Promise<ServerInfo> {
    this.ensureConnected();
    if (this.shouldThrowOnOperation) {
      throw new Error("Operation failed");
    }
    return this.mockServerInfo;
  }

  async listTools(): Promise<Tool[]> {
    this.ensureConnected();
    if (this.shouldThrowOnOperation) {
      throw new Error("Operation failed");
    }
    return this.mockTools;
  }

  async getTool(name: string): Promise<Tool | null> {
    this.ensureConnected();
    if (this.shouldThrowOnOperation) {
      throw new Error("Operation failed");
    }
    return this.mockTools.find((t) => t.name === name) || null;
  }

  async executeTool(_name: string, _args: Record<string, unknown>): Promise<ToolResult> {
    this.ensureConnected();
    if (this.shouldThrowOnOperation) {
      throw new Error("Operation failed");
    }
    return createTextToolResult("Success");
  }

  async listResources(): Promise<Resource[]> {
    this.ensureConnected();
    if (this.shouldThrowOnOperation) {
      throw new Error("Operation failed");
    }
    return this.mockResources;
  }

  async readResource(uri: string): Promise<ResourceContents> {
    this.ensureConnected();
    if (this.shouldThrowOnOperation) {
      throw new Error("Operation failed");
    }
    return createResourceContents(uri, "test content");
  }

  async listPrompts(): Promise<Prompt[]> {
    this.ensureConnected();
    if (this.shouldThrowOnOperation) {
      throw new Error("Operation failed");
    }
    return this.mockPrompts;
  }

  async getPrompt(_name: string, _args?: Record<string, string>): Promise<PromptResult> {
    this.ensureConnected();
    if (this.shouldThrowOnOperation) {
      throw new Error("Operation failed");
    }
    return createPromptResult("User message", "Assistant message");
  }
}

Deno.test("BaseMCPClient - initial state", () => {
  const client = new TestMCPClient();

  assertEquals(client.isConnected(), false);
  assertEquals(client.getTimeout(), 30000);
});

Deno.test("BaseMCPClient - successful connection", async () => {
  const client = new TestMCPClient();

  assertEquals(client.isConnected(), false);

  await client.connect();

  assertEquals(client.isConnected(), true);
});

Deno.test("BaseMCPClient - failed connection", async () => {
  const client = new TestMCPClient();
  client.setShouldThrowOnConnect(true);

  await assertThrowsAsync(
    () => client.connect(),
    "Connection failed",
  );

  assertEquals(client.isConnected(), false);
});

Deno.test("BaseMCPClient - disconnect", async () => {
  const client = new TestMCPClient();

  await client.connect();
  assertEquals(client.isConnected(), true);

  await client.disconnect();
  assertEquals(client.isConnected(), false);
});

Deno.test("BaseMCPClient - setTimeout/getTimeout", () => {
  const client = new TestMCPClient();

  assertEquals(client.getTimeout(), 30000);

  client.setTimeout(5000);
  assertEquals(client.getTimeout(), 5000);

  client.setTimeout(60000);
  assertEquals(client.getTimeout(), 60000);
});

Deno.test("BaseMCPClient - ensureConnected throws when not connected", async () => {
  const client = new TestMCPClient();

  // All operations should fail when not connected
  await assertThrowsAsync(
    () => client.getServerInfo(),
    "Client is not connected",
  );

  await assertThrowsAsync(
    () => client.listTools(),
    "Client is not connected",
  );

  await assertThrowsAsync(
    () => client.getTool("test"),
    "Client is not connected",
  );

  await assertThrowsAsync(
    () => client.executeTool("test", {}),
    "Client is not connected",
  );

  await assertThrowsAsync(
    () => client.listResources(),
    "Client is not connected",
  );

  await assertThrowsAsync(
    () => client.readResource("test:///uri"),
    "Client is not connected",
  );

  await assertThrowsAsync(
    () => client.listPrompts(),
    "Client is not connected",
  );

  await assertThrowsAsync(
    () => client.getPrompt("test"),
    "Client is not connected",
  );
});

Deno.test("BaseMCPClient - getServerInfo success", async () => {
  const client = new TestMCPClient();
  const serverInfo = createMinimalServerInfo("test-server");
  client.setMockServerInfo(serverInfo);

  await client.connect();
  const info = await client.getServerInfo();

  assertExists(info);
  assertEquals(info.name, "test-server");
});

Deno.test("BaseMCPClient - listTools success", async () => {
  const client = new TestMCPClient();
  const tools = [
    createSimpleTool("tool1", "Tool 1"),
    createSimpleTool("tool2", "Tool 2"),
  ];
  client.setMockTools(tools);

  await client.connect();
  const result = await client.listTools();

  assertEquals(result.length, 2);
  assertEquals(result[0].name, "tool1");
  assertEquals(result[1].name, "tool2");
});

Deno.test("BaseMCPClient - getTool success", async () => {
  const client = new TestMCPClient();
  const tools = [
    createSimpleTool("tool1", "Tool 1"),
    createSimpleTool("tool2", "Tool 2"),
  ];
  client.setMockTools(tools);

  await client.connect();

  const tool1 = await client.getTool("tool1");
  assertExists(tool1);
  assertEquals(tool1.name, "tool1");

  const tool2 = await client.getTool("tool2");
  assertExists(tool2);
  assertEquals(tool2.name, "tool2");

  const nonExistent = await client.getTool("nonexistent");
  assertEquals(nonExistent, null);
});

Deno.test("BaseMCPClient - executeTool success", async () => {
  const client = new TestMCPClient();

  await client.connect();
  const result = await client.executeTool("test-tool", { param: "value" });

  assertExists(result);
  assertExists(result.content);
  assertEquals(result.content.length, 1);
  assertEquals(result.content[0].type, "text");
});

Deno.test("BaseMCPClient - listResources success", async () => {
  const client = new TestMCPClient();
  const resources = [
    createResource("file:///test1.txt", "test1.txt"),
    createResource("file:///test2.txt", "test2.txt"),
  ];
  client.setMockResources(resources);

  await client.connect();
  const result = await client.listResources();

  assertEquals(result.length, 2);
  assertEquals(result[0].uri, "file:///test1.txt");
  assertEquals(result[1].uri, "file:///test2.txt");
});

Deno.test("BaseMCPClient - readResource success", async () => {
  const client = new TestMCPClient();

  await client.connect();
  const result = await client.readResource("file:///test.txt");

  assertExists(result);
  assertEquals(result.uri, "file:///test.txt");
  assertExists(result.contents);
});

Deno.test("BaseMCPClient - listPrompts success", async () => {
  const client = new TestMCPClient();
  const prompts = [
    createPrompt("prompt1", "Prompt 1"),
    createPrompt("prompt2", "Prompt 2"),
  ];
  client.setMockPrompts(prompts);

  await client.connect();
  const result = await client.listPrompts();

  assertEquals(result.length, 2);
  assertEquals(result[0].name, "prompt1");
  assertEquals(result[1].name, "prompt2");
});

Deno.test("BaseMCPClient - getPrompt success", async () => {
  const client = new TestMCPClient();

  await client.connect();
  const result = await client.getPrompt("test-prompt", { arg: "value" });

  assertExists(result);
  assertExists(result.messages);
  assertEquals(result.messages.length, 2);
});

Deno.test("BaseMCPClient - operations fail when shouldThrowOnOperation is true", async () => {
  const client = new TestMCPClient();
  client.setShouldThrowOnOperation(true);

  await client.connect();

  await assertThrowsAsync(
    () => client.getServerInfo(),
    "Operation failed",
  );

  await assertThrowsAsync(
    () => client.listTools(),
    "Operation failed",
  );

  await assertThrowsAsync(
    () => client.getTool("test"),
    "Operation failed",
  );

  await assertThrowsAsync(
    () => client.executeTool("test", {}),
    "Operation failed",
  );

  await assertThrowsAsync(
    () => client.listResources(),
    "Operation failed",
  );

  await assertThrowsAsync(
    () => client.readResource("test:///uri"),
    "Operation failed",
  );

  await assertThrowsAsync(
    () => client.listPrompts(),
    "Operation failed",
  );

  await assertThrowsAsync(
    () => client.getPrompt("test"),
    "Operation failed",
  );
});

Deno.test({
  name: "BaseMCPClient - createTimeoutPromise completes within timeout",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const client = new TestMCPClient();
    client.setTimeout(1000);

    const fastPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve("success"), 100);
    });

    // Access the protected method via a test subclass method
    const result = await (client as unknown as {
      createTimeoutPromise<T>(p: Promise<T>): Promise<T>;
    }).createTimeoutPromise(fastPromise);

    assertEquals(result, "success");
  },
});

Deno.test({
  name: "BaseMCPClient - createTimeoutPromise throws when timeout exceeded",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const client = new TestMCPClient();
    client.setTimeout(100);

    const slowPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve("success"), 500);
    });

    await assertThrowsAsync(
      () =>
        (client as unknown as {
          createTimeoutPromise<T>(p: Promise<T>): Promise<T>;
        }).createTimeoutPromise(slowPromise),
      /Operation timed out after 100ms/,
    );
  },
});

Deno.test("BaseMCPClient - multiple connect/disconnect cycles", async () => {
  const client = new TestMCPClient();

  // First cycle
  await client.connect();
  assertEquals(client.isConnected(), true);
  await client.disconnect();
  assertEquals(client.isConnected(), false);

  // Second cycle
  await client.connect();
  assertEquals(client.isConnected(), true);
  await client.disconnect();
  assertEquals(client.isConnected(), false);

  // Third cycle
  await client.connect();
  assertEquals(client.isConnected(), true);
  await client.disconnect();
  assertEquals(client.isConnected(), false);
});
