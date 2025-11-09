import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { StdioMCPClient } from "../../../src/client/stdio.ts";
import type { StdioServerConfig } from "../../../src/types/config.ts";
import {
  createTextToolResult,
  createResourceContents,
  createPromptResult,
  SAMPLE_TOOLS,
  SAMPLE_RESOURCES,
  SAMPLE_PROMPTS,
} from "../../fixtures/test-data.ts";

// Mock the MCP SDK Client and Transport
class MockStdioTransport {
  async close(): Promise<void> {
    // Mock close
  }
}

class MockClient {
  private connected = false;
  private mockData: {
    serverVersion?: unknown;
    tools?: unknown[];
    resources?: unknown[];
    prompts?: unknown[];
    toolResults?: Map<string, unknown>;
    resourceContents?: Map<string, unknown>;
    promptResults?: Map<string, unknown>;
  } = {
    toolResults: new Map(),
    resourceContents: new Map(),
    promptResults: new Map(),
  };

  setMockData(data: typeof this.mockData): void {
    this.mockData = { ...this.mockData, ...data };
  }

  async connect(_transport: unknown): Promise<void> {
    this.connected = true;
  }

  async close(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getServerVersion(): unknown {
    return this.mockData.serverVersion || {
      protocolVersion: "1.0.0",
      capabilities: {},
      serverInfo: { name: "test", version: "1.0.0" },
    };
  }

  async listTools(): Promise<{ tools: unknown[] }> {
    return { tools: this.mockData.tools || [] };
  }

  async callTool({ name }: { name: string; arguments: unknown }): Promise<unknown> {
    const result = this.mockData.toolResults?.get(name);
    if (!result) {
      throw new Error(`Tool ${name} not found`);
    }
    return result;
  }

  async listResources(): Promise<{ resources: unknown[] }> {
    return { resources: this.mockData.resources || [] };
  }

  async readResource({ uri }: { uri: string }): Promise<unknown> {
    const contents = this.mockData.resourceContents?.get(uri);
    if (!contents) {
      throw new Error(`Resource ${uri} not found`);
    }
    return contents;
  }

  async listPrompts(): Promise<{ prompts: unknown[] }> {
    return { prompts: this.mockData.prompts || [] };
  }

  async getPrompt({ name }: { name: string; arguments?: unknown }): Promise<unknown> {
    const result = this.mockData.promptResults?.get(name);
    if (!result) {
      throw new Error(`Prompt ${name} not found`);
    }
    return result;
  }
}

let mockClient: MockClient;
let mockProcess: Partial<Deno.ChildProcess> | null = null;

function setupMocks() {
  mockClient = new MockClient();
  mockProcess = {
    kill: () => {},
    stdin: {} as WritableStream<Uint8Array>,
    stdout: {
      arrayBuffer: async () => new ArrayBuffer(0),
      bytes: async () => new Uint8Array(0),
      json: async () => ({}),
      text: async () => "",
    } as any,
    stderr: {
      arrayBuffer: async () => new ArrayBuffer(0),
      bytes: async () => new Uint8Array(0),
      json: async () => ({}),
      text: async () => "",
    } as any,
    status: Promise.resolve({ code: 0, success: true, signal: null }),
  };

  // Mock Deno.Command
  (globalThis.Deno as any).Command = class {
    constructor(_command: string, _options: unknown) {}
    spawn(): Deno.ChildProcess {
      return mockProcess as Deno.ChildProcess;
    }
  };
}

function cleanupMocks() {
  // Don't try to restore Deno as it's read-only
  mockProcess = null;
}

Deno.test({
  name: "StdioMCPClient - constructor sets config and timeout",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "test-command",
        args: ["--flag"],
        env: { TEST: "value" },
        timeout: 5000,
      };

      const client = new StdioMCPClient("test-server", config);

      assertEquals(client.isConnected(), false);
      assertEquals(client.getTimeout(), 5000);
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - connect creates process and client",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      // Override the SDK imports by patching the client instance
      const client = new StdioMCPClient("test-server", config);

      // Monkey-patch the client's internal client and transport
      (client as any).client = mockClient;
      (client as any).transport = new MockStdioTransport();
      (client as any).process = mockProcess;

      await client.connect();

      assertEquals(client.isConnected(), true);
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - connect handles already connected",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const client = new StdioMCPClient("test-server", config);
      (client as any).client = mockClient;
      (client as any).transport = new MockStdioTransport();
      (client as any).process = mockProcess;

      await client.connect();
      assertEquals(client.isConnected(), true);

      // Connect again should not throw
      await client.connect();
      assertEquals(client.isConnected(), true);
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - disconnect closes client and transport",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const client = new StdioMCPClient("test-server", config);
      (client as any).client = mockClient;
      (client as any).transport = new MockStdioTransport();
      (client as any).process = mockProcess;

      await client.connect();
      assertEquals(client.isConnected(), true);

      await client.disconnect();
      assertEquals(client.isConnected(), false);
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - disconnect when not connected does nothing",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const client = new StdioMCPClient("test-server", config);

      assertEquals(client.isConnected(), false);
      await client.disconnect();
      assertEquals(client.isConnected(), false);
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - getServerInfo returns server information",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const client = new StdioMCPClient("test-server", config);
      (client as any).client = mockClient;
      (client as any).transport = new MockStdioTransport();
      (client as any).process = mockProcess;
      (client as any).connected = true;

      mockClient.setMockData({
        serverVersion: {
          protocolVersion: "2.0.0",
          capabilities: { tools: {} },
          serverInfo: { name: "Test Server", version: "1.0.0" },
        },
      });

      const info = await client.getServerInfo();

      assertExists(info);
      assertEquals(info.name, "test-server");
      assertEquals(info.protocolVersion, "2.0.0");
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - listTools returns tools",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const client = new StdioMCPClient("test-server", config);
      (client as any).client = mockClient;
      (client as any).transport = new MockStdioTransport();
      (client as any).process = mockProcess;
      (client as any).connected = true;

      mockClient.setMockData({
        tools: SAMPLE_TOOLS,
      });

      const tools = await client.listTools();

      assertExists(tools);
      assertEquals(tools.length, 3);
      assertEquals(tools[0].name, "simple_tool");
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - getTool returns specific tool",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const client = new StdioMCPClient("test-server", config);
      (client as any).client = mockClient;
      (client as any).transport = new MockStdioTransport();
      (client as any).process = mockProcess;
      (client as any).connected = true;

      mockClient.setMockData({
        tools: SAMPLE_TOOLS,
      });

      const tool = await client.getTool("simple_tool");

      assertExists(tool);
      assertEquals(tool.name, "simple_tool");

      const notFound = await client.getTool("nonexistent");
      assertEquals(notFound, null);
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - executeTool executes tool",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const client = new StdioMCPClient("test-server", config);
      (client as any).client = mockClient;
      (client as any).transport = new MockStdioTransport();
      (client as any).process = mockProcess;
      (client as any).connected = true;

      const toolResult = createTextToolResult("Success");
      mockClient.setMockData({
        toolResults: new Map([["test-tool", toolResult]]),
      });

      const result = await client.executeTool("test-tool", { param: "value" });

      assertExists(result);
      assertEquals(result.content.length, 1);
      assertEquals(result.content[0].type, "text");
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - listResources returns resources",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const client = new StdioMCPClient("test-server", config);
      (client as any).client = mockClient;
      (client as any).transport = new MockStdioTransport();
      (client as any).process = mockProcess;
      (client as any).connected = true;

      mockClient.setMockData({
        resources: SAMPLE_RESOURCES,
      });

      const resources = await client.listResources();

      assertExists(resources);
      assertEquals(resources.length, 3);
      assertEquals(resources[0].uri, "file:///test1.txt");
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - readResource reads resource",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const client = new StdioMCPClient("test-server", config);
      (client as any).client = mockClient;
      (client as any).transport = new MockStdioTransport();
      (client as any).process = mockProcess;
      (client as any).connected = true;

      const contents = createResourceContents("file:///test.txt", "test content");
      mockClient.setMockData({
        resourceContents: new Map([["file:///test.txt", contents]]),
      });

      const result = await client.readResource("file:///test.txt");

      assertExists(result);
      assertEquals(result.uri, "file:///test.txt");
      assertExists(result.contents);
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - listPrompts returns prompts",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const client = new StdioMCPClient("test-server", config);
      (client as any).client = mockClient;
      (client as any).transport = new MockStdioTransport();
      (client as any).process = mockProcess;
      (client as any).connected = true;

      mockClient.setMockData({
        prompts: SAMPLE_PROMPTS,
      });

      const prompts = await client.listPrompts();

      assertExists(prompts);
      assertEquals(prompts.length, 2);
      assertEquals(prompts[0].name, "simple_prompt");
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - getPrompt gets prompt",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const client = new StdioMCPClient("test-server", config);
      (client as any).client = mockClient;
      (client as any).transport = new MockStdioTransport();
      (client as any).process = mockProcess;
      (client as any).connected = true;

      const promptResult = createPromptResult("User message", "Assistant message");
      mockClient.setMockData({
        promptResults: new Map([["test-prompt", promptResult]]),
      });

      const result = await client.getPrompt("test-prompt", { arg: "value" });

      assertExists(result);
      assertExists(result.messages);
      assertEquals(result.messages.length, 2);
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - operations throw when not connected",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const client = new StdioMCPClient("test-server", config);

      await assertRejects(
        () => client.getServerInfo(),
        Error,
        "Client is not connected",
      );

      await assertRejects(
        () => client.listTools(),
        Error,
        "Client is not connected",
      );

      await assertRejects(
        () => client.executeTool("test", {}),
        Error,
        "Client is not connected",
      );

      await assertRejects(
        () => client.listResources(),
        Error,
        "Client is not connected",
      );

      await assertRejects(
        () => client.readResource("file:///test.txt"),
        Error,
        "Client is not connected",
      );

      await assertRejects(
        () => client.listPrompts(),
        Error,
        "Client is not connected",
      );

      await assertRejects(
        () => client.getPrompt("test"),
        Error,
        "Client is not connected",
      );
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - handles command with cwd option",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
        cwd: "/path/to/dir",
      };

      const client = new StdioMCPClient("test-server", config);
      assertExists(client);
    } finally {
      cleanupMocks();
    }
  },
});

Deno.test({
  name: "StdioMCPClient - disconnect handles errors gracefully",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMocks();
    try {
      const config: StdioServerConfig = {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const client = new StdioMCPClient("test-server", config);

      // Create a mock client that throws on close
      const errorClient = {
        close: async () => {
          throw new Error("Close failed");
        },
      };

      (client as any).client = errorClient;
      (client as any).transport = new MockStdioTransport();
      (client as any).process = mockProcess;
      (client as any).connected = true;

      // Should not throw, just log and set connected to false
      await client.disconnect();
      assertEquals(client.isConnected(), false);
    } finally {
      cleanupMocks();
    }
  },
});
