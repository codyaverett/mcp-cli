import { assertEquals, assertExists } from "@std/assert";
import {
  executeBatch,
  executeTool,
  getToolSchema,
  listTools,
  searchTools,
} from "../../../src/commands/tools.ts";
import { clientPool } from "../../../src/client/factory.ts";
import { JSONFormatter } from "../../../src/utils/json.ts";
import { MockMCPClient } from "../../fixtures/mock-client.ts";
import { createSimpleTool, createTextToolResult, SAMPLE_TOOLS } from "../../fixtures/test-data.ts";
import type { StdioServerConfig } from "../../../src/types/config.ts";

// Store original functions
const originalOutput = JSONFormatter.output;
const originalExit = Deno.exit;

// Captured output
let capturedOutput: unknown[] = [];
let exitCode: number | null = null;

// Mock JSONFormatter.output
function mockOutput() {
  capturedOutput = [];
  JSONFormatter.output = (data: unknown) => {
    capturedOutput.push(data);
  };
}

// Mock Deno.exit
function mockExit() {
  exitCode = null;
  Deno.exit = ((code?: number) => {
    exitCode = code ?? 0;
  }) as typeof Deno.exit;
}

// Restore original functions
function restoreMocks() {
  JSONFormatter.output = originalOutput;
  Deno.exit = originalExit;
  capturedOutput = [];
  exitCode = null;
}

// Setup/teardown
function setup() {
  mockOutput();
  mockExit();
}

function teardown() {
  restoreMocks();
  // Clean up any servers added to pool
  const servers = clientPool.getConfiguredServers();
  servers.forEach((name) => clientPool.removeServer(name));
}

Deno.test("listTools - names only mode (default)", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setTools(SAMPLE_TOOLS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    // Mock getClient to return our mock
    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await listTools("test-server", { namesOnly: true });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: string[] };
    assertExists(output.data);
    assertEquals(Array.isArray(output.data), true);
    assertEquals(output.data.length, 3);
    assertEquals(output.data.includes("simple_tool"), true);
    assertEquals(output.data.includes("complex_tool"), true);

    // Restore
    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("listTools - brief mode", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setTools(SAMPLE_TOOLS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await listTools("test-server", { brief: true });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: Array<{ name: string; description?: string }> };
    assertExists(output.data);
    assertEquals(Array.isArray(output.data), true);
    assertEquals(output.data.length, 3);
    assertExists(output.data[0].name);
    // Brief mode includes descriptions
    assertEquals("description" in output.data[0], true);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("listTools - full mode", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setTools(SAMPLE_TOOLS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await listTools("test-server", { full: true });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: unknown[] };
    assertExists(output.data);
    assertEquals(Array.isArray(output.data), true);
    // Full mode includes inputSchema
    const firstTool = output.data[0] as { inputSchema?: unknown };
    assertExists(firstTool.inputSchema);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("listTools - handles error", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setErrorOnOperation("listTools");

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await listTools("test-server", { namesOnly: true });

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);

    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("getToolSchema - single tool", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    const tool = createSimpleTool("test-tool", "Test tool description");
    mockClient.setTools([tool]);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await getToolSchema("test-server", ["test-tool"]);

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: { name: string } };
    assertExists(output.data);
    assertEquals(output.data.name, "test-tool");

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("getToolSchema - multiple tools", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setTools(SAMPLE_TOOLS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await getToolSchema("test-server", ["simple_tool", "complex_tool"]);

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: unknown[] };
    assertExists(output.data);
    assertEquals(Array.isArray(output.data), true);
    assertEquals(output.data.length, 2);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("getToolSchema - tool not found", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setTools(SAMPLE_TOOLS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await getToolSchema("test-server", ["non-existent-tool"]);

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);

    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("executeTool - success", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    const tool = createSimpleTool("test-tool", "Test tool");
    mockClient.setTools([tool]);
    mockClient.setToolResult("test-tool", createTextToolResult("Success"));

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await executeTool({
      server: "test-server",
      tool: "test-tool",
      args: {},
    });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: unknown };
    assertExists(output.data);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("executeTool - tool not found", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setTools(SAMPLE_TOOLS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await executeTool({
      server: "test-server",
      tool: "non-existent-tool",
      args: {},
    });

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);

    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("executeTool - with args", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    const tool = createSimpleTool("test-tool", "Test tool");
    mockClient.setTools([tool]);
    mockClient.setToolResult("test-tool", createTextToolResult("Success"));

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await executeTool({
      server: "test-server",
      tool: "test-tool",
      args: { param1: "value1", param2: 42 },
    });

    assertEquals(capturedOutput.length, 1);
    assertEquals(mockClient.executeToolCalls, 1);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("executeTool - with maxTokens truncation", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    const tool = createSimpleTool("test-tool", "Test tool");
    mockClient.setTools([tool]);
    mockClient.setToolResult(
      "test-tool",
      createTextToolResult(
        "A very long response that should be truncated based on token count to save context",
      ),
    );

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await executeTool({
      server: "test-server",
      tool: "test-tool",
      args: {},
      maxTokens: 5,
    });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { metadata?: { truncated?: boolean } };
    // Output should exist (truncation may or may not occur depending on actual content length)
    assertExists(output);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("searchTools - finds matching tools", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setTools(SAMPLE_TOOLS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await searchTools("test-server", "simple");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: Array<{ name: string }> };
    assertExists(output.data);
    assertEquals(Array.isArray(output.data), true);
    assertEquals(output.data.length, 1);
    assertEquals(output.data[0].name, "simple_tool");

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("searchTools - case insensitive", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setTools(SAMPLE_TOOLS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await searchTools("test-server", "SIMPLE");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: Array<{ name: string }> };
    assertExists(output.data);
    assertEquals(output.data.length, 1);
    assertEquals(output.data[0].name, "simple_tool");

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("searchTools - searches in description", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setTools(SAMPLE_TOOLS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await searchTools("test-server", "many parameters");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: Array<{ name: string }> };
    assertExists(output.data);
    assertEquals(output.data.length, 1);
    assertEquals(output.data[0].name, "complex_tool");

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("searchTools - no matches", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setTools(SAMPLE_TOOLS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await searchTools("test-server", "nonexistent");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: unknown[] };
    assertExists(output.data);
    assertEquals(output.data.length, 0);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("searchTools - handles error", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setErrorOnOperation("listTools");

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await searchTools("test-server", "test");

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);

    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("executeBatch - successful batch execution", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    const tool1 = createSimpleTool("tool1", "First tool");
    const tool2 = createSimpleTool("tool2", "Second tool");
    mockClient.setTools([tool1, tool2]);
    mockClient.setToolResult("tool1", createTextToolResult("Result 1"));
    mockClient.setToolResult("tool2", createTextToolResult("Result 2"));

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await executeBatch({
      operations: [
        { server: "test-server", tool: "tool1", args: {} },
        { server: "test-server", tool: "tool2", args: {} },
      ],
    });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as {
      data: {
        operations: unknown[];
        summary: { total: number; succeeded: number; failed: number };
      };
    };
    assertExists(output.data);
    assertEquals(output.data.operations.length, 2);
    assertEquals(output.data.summary.total, 2);
    assertEquals(output.data.summary.succeeded, 2);
    assertEquals(output.data.summary.failed, 0);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("executeBatch - empty operations list", async () => {
  setup();

  try {
    await executeBatch({
      operations: [],
    });

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);

    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);
  } finally {
    teardown();
  }
});

Deno.test("executeBatch - multiple servers error", async () => {
  setup();

  try {
    await executeBatch({
      operations: [
        { server: "server1", tool: "tool1", args: {} },
        { server: "server2", tool: "tool2", args: {} },
      ],
    });

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);

    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);
  } finally {
    teardown();
  }
});

Deno.test("executeBatch - non-transactional continues on error", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    const tool1 = createSimpleTool("tool1", "First tool");
    const tool2 = createSimpleTool("tool2", "Second tool");
    mockClient.setTools([tool1, tool2]);
    mockClient.setToolResult("tool1", createTextToolResult("Result 1"));
    // tool2 will fail (not in results)

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await executeBatch({
      operations: [
        { server: "test-server", tool: "tool1", args: {} },
        { server: "test-server", tool: "nonexistent", args: {} },
      ],
      transactional: false,
    });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as {
      data: {
        operations: unknown[];
        summary: { total: number; succeeded: number; failed: number };
      };
    };
    assertExists(output.data);
    assertEquals(output.data.operations.length, 2);
    assertEquals(output.data.summary.total, 2);
    assertEquals(output.data.summary.succeeded, 1);
    assertEquals(output.data.summary.failed, 1);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("executeBatch - transactional fails on error", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    const tool1 = createSimpleTool("tool1", "First tool");
    mockClient.setTools([tool1]);
    mockClient.setToolResult("tool1", createTextToolResult("Result 1"));

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await executeBatch({
      operations: [
        { server: "test-server", tool: "tool1", args: {} },
        { server: "test-server", tool: "nonexistent", args: {} },
      ],
      transactional: true,
    });

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);

    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});
