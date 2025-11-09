import { assertEquals, assertExists } from "@std/assert";
import {
  searchAllServers,
  recommendTools,
  searchToolsDetailed,
} from "../../../src/commands/search.ts";
import { configLoader } from "../../../src/config/loader.ts";
import { clientPool } from "../../../src/client/factory.ts";
import { JSONFormatter } from "../../../src/utils/json.ts";
import { MockMCPClient } from "../../fixtures/mock-client.ts";
import { SAMPLE_TOOLS, createSimpleTool } from "../../fixtures/test-data.ts";
import type { Config } from "../../../src/types/config.ts";

// Store original functions
const originalOutput = JSONFormatter.output;
const originalExit = Deno.exit;
const originalGetConfig = configLoader.getConfig.bind(configLoader);

// Captured output
let capturedOutput: unknown[] = [];
let exitCode: number | null = null;
let mockConfig: Config = { servers: {} };

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

// Mock config loader
function mockConfigLoader() {
  configLoader.getConfig = async () => mockConfig;
}

// Restore original functions
function restoreMocks() {
  JSONFormatter.output = originalOutput;
  Deno.exit = originalExit;
  configLoader.getConfig = originalGetConfig;
  capturedOutput = [];
  exitCode = null;
  mockConfig = { servers: {} };
}

// Setup/teardown
function setup() {
  mockOutput();
  mockExit();
  mockConfigLoader();
}

function teardown() {
  restoreMocks();
  const servers = clientPool.getConfiguredServers();
  servers.forEach((name) => clientPool.removeServer(name));
}

Deno.test("searchAllServers - finds tools across servers", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
      "server2": { type: "stdio", command: "test2", enabled: true },
    };

    const mockClient1 = new MockMCPClient();
    mockClient1.setTools([
      createSimpleTool("search_tool", "A tool for searching"),
      createSimpleTool("other_tool", "Another tool"),
    ]);

    const mockClient2 = new MockMCPClient();
    mockClient2.setTools([
      createSimpleTool("search_helper", "Helps with searching"),
    ]);

    clientPool.addServer("server1", mockConfig.servers["server1"]);
    clientPool.addServer("server2", mockConfig.servers["server2"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async (name: string) => {
      if (name === "server1") {
        await mockClient1.connect();
        return mockClient1;
      } else {
        await mockClient2.connect();
        return mockClient2;
      }
    };

    await searchAllServers("search");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: Record<string, string[]> };
    assertExists(output.data);
    assertEquals(Object.keys(output.data).length, 2);
    assertEquals(output.data["server1"].includes("search_tool"), true);
    assertEquals(output.data["server2"].includes("search_helper"), true);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("searchAllServers - case insensitive", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
    };

    const mockClient = new MockMCPClient();
    mockClient.setTools([
      createSimpleTool("Search_Tool", "A tool for searching"),
    ]);

    clientPool.addServer("server1", mockConfig.servers["server1"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => {
      await mockClient.connect();
      return mockClient;
    };

    await searchAllServers("search");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: Record<string, string[]> };
    assertExists(output.data);
    assertEquals(output.data["server1"].includes("Search_Tool"), true);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("searchAllServers - searches in description", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
    };

    const mockClient = new MockMCPClient();
    mockClient.setTools([
      createSimpleTool("tool1", "This tool helps with searching data"),
    ]);

    clientPool.addServer("server1", mockConfig.servers["server1"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => {
      await mockClient.connect();
      return mockClient;
    };

    await searchAllServers("searching");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: Record<string, string[]> };
    assertExists(output.data);
    assertEquals(output.data["server1"].includes("tool1"), true);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("searchAllServers - with limit", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
    };

    const mockClient = new MockMCPClient();
    mockClient.setTools([
      createSimpleTool("search_tool_1", "Search tool 1"),
      createSimpleTool("search_tool_2", "Search tool 2"),
      createSimpleTool("search_tool_3", "Search tool 3"),
    ]);

    clientPool.addServer("server1", mockConfig.servers["server1"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => {
      await mockClient.connect();
      return mockClient;
    };

    await searchAllServers("search", 2);

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: Record<string, string[]> };
    assertExists(output.data);
    assertEquals(output.data["server1"].length, 2);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("searchAllServers - skips disabled servers", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
      "server2": { type: "stdio", command: "test2", enabled: false },
    };

    const mockClient1 = new MockMCPClient();
    mockClient1.setTools([createSimpleTool("search_tool", "Search tool")]);

    clientPool.addServer("server1", mockConfig.servers["server1"]);
    clientPool.addServer("server2", mockConfig.servers["server2"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => {
      await mockClient1.connect();
      return mockClient1;
    };

    await searchAllServers("search");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: Record<string, string[]> };
    assertExists(output.data);
    assertEquals(Object.keys(output.data).length, 1);
    assertEquals(Object.keys(output.data).includes("server2"), false);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("searchAllServers - handles server errors gracefully", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
      "server2": { type: "stdio", command: "test2", enabled: true },
    };

    const mockClient1 = new MockMCPClient();
    mockClient1.setTools([createSimpleTool("search_tool", "Search tool")]);

    const mockClient2 = new MockMCPClient();
    mockClient2.setErrorOnOperation("listTools");

    clientPool.addServer("server1", mockConfig.servers["server1"]);
    clientPool.addServer("server2", mockConfig.servers["server2"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async (name: string) => {
      if (name === "server1") {
        await mockClient1.connect();
        return mockClient1;
      } else {
        await mockClient2.connect();
        return mockClient2;
      }
    };

    await searchAllServers("search");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: Record<string, string[]> };
    assertExists(output.data);
    // Should continue with server1 despite server2 error
    assertEquals(output.data["server1"] !== undefined, true);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("recommendTools - finds relevant tools", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
    };

    const mockClient = new MockMCPClient();
    mockClient.setTools([
      createSimpleTool("file_search", "Search for files in the filesystem"),
      createSimpleTool("web_search", "Search the web for information"),
      createSimpleTool("calculate", "Perform mathematical calculations"),
    ]);

    clientPool.addServer("server1", mockConfig.servers["server1"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => {
      await mockClient.connect();
      return mockClient;
    };

    await recommendTools("I need to search for files");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: { tools: Array<{ tool: string; confidence: number }> } };
    assertExists(output.data);
    assertExists(output.data.tools);
    assertEquals(Array.isArray(output.data.tools), true);
    // Should recommend search-related tools
    const hasSearchTool = output.data.tools.some(t => t.tool.includes("search"));
    assertEquals(hasSearchTool, true);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("recommendTools - scores by name and description", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
    };

    const mockClient = new MockMCPClient();
    mockClient.setTools([
      createSimpleTool("calculate_sum", "Calculate the sum of numbers"),
      createSimpleTool("other_tool", "Does something else"),
    ]);

    clientPool.addServer("server1", mockConfig.servers["server1"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => {
      await mockClient.connect();
      return mockClient;
    };

    await recommendTools("calculate numbers");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: { tools: Array<{ tool: string }> } };
    assertExists(output.data);
    assertExists(output.data.tools);
    // calculate_sum should be recommended
    const hasCalculate = output.data.tools.some(t => t.tool === "calculate_sum");
    assertEquals(hasCalculate, true);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("recommendTools - limits to top 10 results", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
    };

    const mockClient = new MockMCPClient();
    const manyTools = [];
    for (let i = 0; i < 20; i++) {
      manyTools.push(createSimpleTool(`tool_${i}`, "Search tool"));
    }
    mockClient.setTools(manyTools);

    clientPool.addServer("server1", mockConfig.servers["server1"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => {
      await mockClient.connect();
      return mockClient;
    };

    await recommendTools("search");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: { tools: unknown[] } };
    assertExists(output.data);
    assertExists(output.data.tools);
    assertEquals(output.data.tools.length <= 10, true);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("searchToolsDetailed - returns tools with descriptions", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
    };

    const mockClient = new MockMCPClient();
    mockClient.setTools(SAMPLE_TOOLS);

    clientPool.addServer("server1", mockConfig.servers["server1"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => {
      await mockClient.connect();
      return mockClient;
    };

    await searchToolsDetailed("simple");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: Record<string, Array<{ name: string; description?: string }>> };
    assertExists(output.data);
    assertExists(output.data["server1"]);
    assertEquals(Array.isArray(output.data["server1"]), true);
    assertEquals(output.data["server1"][0].name, "simple_tool");
    assertEquals("description" in output.data["server1"][0], true);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("searchToolsDetailed - with limit", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
    };

    const mockClient = new MockMCPClient();
    mockClient.setTools([
      createSimpleTool("search_1", "Search 1"),
      createSimpleTool("search_2", "Search 2"),
      createSimpleTool("search_3", "Search 3"),
    ]);

    clientPool.addServer("server1", mockConfig.servers["server1"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => {
      await mockClient.connect();
      return mockClient;
    };

    await searchToolsDetailed("search", 2);

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: Record<string, unknown[]> };
    assertExists(output.data);
    assertEquals(output.data["server1"].length, 2);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("searchAllServers - handles errors", async () => {
  setup();

  try {
    // Override getConfig to throw
    configLoader.getConfig = async () => {
      throw new Error("Config load failed");
    };

    await searchAllServers("test");

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);
  } finally {
    teardown();
  }
});

Deno.test("recommendTools - handles errors", async () => {
  setup();

  try {
    // Override getConfig to throw
    configLoader.getConfig = async () => {
      throw new Error("Config load failed");
    };

    await recommendTools("test task");

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);
  } finally {
    teardown();
  }
});

Deno.test("searchToolsDetailed - handles errors", async () => {
  setup();

  try {
    // Override getConfig to throw
    configLoader.getConfig = async () => {
      throw new Error("Config load failed");
    };

    await searchToolsDetailed("test");

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);
  } finally {
    teardown();
  }
});
