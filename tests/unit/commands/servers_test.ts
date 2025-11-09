import { assertEquals, assertExists } from "@std/assert";
import {
  listServers,
  addServer,
  removeServer,
  testServer,
  getServerInfo,
  inspectServer,
  initConfig,
} from "../../../src/commands/servers.ts";
import { configLoader } from "../../../src/config/loader.ts";
import { clientPool } from "../../../src/client/factory.ts";
import { JSONFormatter } from "../../../src/utils/json.ts";
import { Platform } from "../../../src/utils/platform.ts";
import { MockMCPClient } from "../../fixtures/mock-client.ts";
import { SAMPLE_SERVER_INFO, SAMPLE_TOOLS, SAMPLE_RESOURCES, SAMPLE_PROMPTS } from "../../fixtures/test-data.ts";
import type { StdioServerConfig, Config } from "../../../src/types/config.ts";

// Store original functions
const originalOutput = JSONFormatter.output;
const originalExit = Deno.exit;
const originalGetConfig = configLoader.getConfig.bind(configLoader);
const originalSetServer = configLoader.setServer.bind(configLoader);
const originalGetServer = configLoader.getServer.bind(configLoader);
const originalRemoveServer = configLoader.removeServer.bind(configLoader);

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
  configLoader.setServer = async (name: string, config: unknown) => {
    mockConfig.servers[name] = config as any;
  };
  configLoader.getServer = async (name: string) => {
    const server = mockConfig.servers[name];
    if (!server) {
      throw new Error(`Server '${name}' not found`);
    }
    return server;
  };
  configLoader.removeServer = async (name: string) => {
    delete mockConfig.servers[name];
  };
}

// Restore original functions
function restoreMocks() {
  JSONFormatter.output = originalOutput;
  Deno.exit = originalExit;
  configLoader.getConfig = originalGetConfig;
  configLoader.setServer = originalSetServer;
  configLoader.getServer = originalGetServer;
  configLoader.removeServer = originalRemoveServer;
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
  // Clean up any servers added to pool
  const servers = clientPool.getConfiguredServers();
  servers.forEach((name) => clientPool.removeServer(name));
}

Deno.test("listServers - names only mode", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
      "server2": { type: "sse", url: "http://localhost:3000", enabled: true },
      "server3": { type: "http", url: "http://localhost:3001", enabled: true },
    };

    await listServers({ namesOnly: true });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: string[] };
    assertExists(output.data);
    assertEquals(Array.isArray(output.data), true);
    assertEquals(output.data.length, 3);
    assertEquals(output.data.includes("server1"), true);
    assertEquals(output.data.includes("server2"), true);
    assertEquals(output.data.includes("server3"), true);
  } finally {
    teardown();
  }
});

Deno.test("listServers - defaults to names only mode", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
      "server2": { type: "sse", url: "http://localhost:3000", enabled: true },
    };

    // Call with no options - should default to names-only
    await listServers({});

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: string[] };
    assertExists(output.data);
    assertEquals(Array.isArray(output.data), true);
    assertEquals(output.data.length, 2);
    assertEquals(output.data.includes("server1"), true);
    assertEquals(output.data.includes("server2"), true);
  } finally {
    teardown();
  }
});

Deno.test("listServers - names only mode with disabled servers", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
      "server2": { type: "stdio", command: "test2", enabled: false },
    };

    await listServers({ namesOnly: true });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: string[] };
    assertEquals(output.data.length, 1);
    assertEquals(output.data[0], "server1");
  } finally {
    teardown();
  }
});

Deno.test("listServers - names only with includeDisabled", async () => {
  setup();

  try {
    mockConfig.servers = {
      "server1": { type: "stdio", command: "test1", enabled: true },
      "server2": { type: "stdio", command: "test2", enabled: false },
    };

    await listServers({ namesOnly: true, includeDisabled: true });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: string[] };
    assertEquals(output.data.length, 2);
  } finally {
    teardown();
  }
});

Deno.test("listServers - full mode", async () => {
  setup();

  try {
    mockConfig.servers = {
      "test-server": { type: "stdio", command: "test", enabled: true },
    };

    const mockClient = new MockMCPClient();
    mockClient.setServerInfo(SAMPLE_SERVER_INFO);

    clientPool.addServer("test-server", mockConfig.servers["test-server"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await listServers({ full: true });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: unknown[] };
    assertExists(output.data);
    assertEquals(Array.isArray(output.data), true);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("addServer - stdio type", async () => {
  setup();

  try {
    await addServer("new-server", {
      name: "new-server",
      type: "stdio",
      command: "test-command",
      args: ["arg1"],
      env: { TEST: "value" },
      enabled: true,
    });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { success: boolean; data: { name: string; type: string } };
    assertEquals(output.success, true);
    assertEquals(output.data.name, "new-server");
    assertEquals(output.data.type, "stdio");

    assertEquals(mockConfig.servers["new-server"] !== undefined, true);
  } finally {
    teardown();
  }
});

Deno.test("addServer - sse type", async () => {
  setup();

  try {
    await addServer("new-server", {
      name: "new-server",
      type: "sse",
      url: "http://localhost:3000",
      apiKey: "test-key",
      enabled: true,
    });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { success: boolean };
    assertEquals(output.success, true);

    assertEquals(mockConfig.servers["new-server"] !== undefined, true);
  } finally {
    teardown();
  }
});

Deno.test("addServer - http type", async () => {
  setup();

  try {
    await addServer("new-server", {
      name: "new-server",
      type: "http",
      url: "http://localhost:3001",
      headers: { "X-Custom": "value" },
      enabled: true,
    });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { success: boolean };
    assertEquals(output.success, true);

    assertEquals(mockConfig.servers["new-server"] !== undefined, true);
  } finally {
    teardown();
  }
});

Deno.test("addServer - server already exists", async () => {
  setup();

  try {
    mockConfig.servers = {
      "existing-server": { type: "stdio", command: "test", enabled: true },
    };

    await addServer("existing-server", {
      name: "existing-server",
      type: "stdio",
      command: "test",
      enabled: true,
    });

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);
  } finally {
    teardown();
  }
});

Deno.test("addServer - missing command for stdio", async () => {
  setup();

  try {
    await addServer("new-server", {
      name: "new-server",
      type: "stdio",
      enabled: true,
    } as any);

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);
  } finally {
    teardown();
  }
});

Deno.test("addServer - missing url for sse", async () => {
  setup();

  try {
    await addServer("new-server", {
      name: "new-server",
      type: "sse",
      enabled: true,
    } as any);

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);
  } finally {
    teardown();
  }
});

Deno.test("addServer - missing url for http", async () => {
  setup();

  try {
    await addServer("new-server", {
      name: "new-server",
      type: "http",
      enabled: true,
    } as any);

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);
  } finally {
    teardown();
  }
});

Deno.test("addServer - invalid transport type", async () => {
  setup();

  try {
    await addServer("new-server", {
      name: "new-server",
      type: "invalid",
      enabled: true,
    } as any);

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);
  } finally {
    teardown();
  }
});

Deno.test("removeServer - success", async () => {
  setup();

  try {
    mockConfig.servers = {
      "test-server": { type: "stdio", command: "test", enabled: true },
    };

    clientPool.addServer("test-server", mockConfig.servers["test-server"]);

    await removeServer("test-server");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { success: boolean; data: { name: string } };
    assertEquals(output.success, true);
    assertEquals(output.data.name, "test-server");

    assertEquals(mockConfig.servers["test-server"], undefined);
  } finally {
    teardown();
  }
});

Deno.test("removeServer - server not found", async () => {
  setup();

  try {
    await removeServer("non-existent");

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);
  } finally {
    teardown();
  }
});

Deno.test("testServer - success", async () => {
  setup();

  try {
    mockConfig.servers = {
      "test-server": { type: "stdio", command: "test", enabled: true },
    };

    const mockClient = new MockMCPClient();
    mockClient.setServerInfo(SAMPLE_SERVER_INFO);

    clientPool.addServer("test-server", mockConfig.servers["test-server"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await testServer("test-server");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: { connected: boolean } };
    assertEquals(output.data.connected, true);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("testServer - connection fails", async () => {
  setup();

  try {
    mockConfig.servers = {
      "test-server": { type: "stdio", command: "test", enabled: true },
    };

    const mockClient = new MockMCPClient();
    mockClient.setShouldFailConnect(true);

    clientPool.addServer("test-server", mockConfig.servers["test-server"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => {
      await mockClient.connect(); // This will throw
      return mockClient;
    };

    await testServer("test-server");

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("getServerInfo - success", async () => {
  setup();

  try {
    mockConfig.servers = {
      "test-server": { type: "stdio", command: "test", enabled: true },
    };

    const mockClient = new MockMCPClient();
    mockClient.setServerInfo(SAMPLE_SERVER_INFO);

    clientPool.addServer("test-server", mockConfig.servers["test-server"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await getServerInfo("test-server");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: { name: string } };
    assertEquals(output.data.name, "test-server");

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("getServerInfo - handles error", async () => {
  setup();

  try {
    mockConfig.servers = {
      "test-server": { type: "stdio", command: "test", enabled: true },
    };

    const mockClient = new MockMCPClient();
    mockClient.setErrorOnOperation("getServerInfo");

    clientPool.addServer("test-server", mockConfig.servers["test-server"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await getServerInfo("test-server");

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("inspectServer - success", async () => {
  setup();

  try {
    mockConfig.servers = {
      "test-server": { type: "stdio", command: "test", enabled: true },
    };

    const mockClient = new MockMCPClient();
    mockClient.setServerInfo(SAMPLE_SERVER_INFO);
    mockClient.setTools(SAMPLE_TOOLS);
    mockClient.setResources(SAMPLE_RESOURCES);
    mockClient.setPrompts(SAMPLE_PROMPTS);

    clientPool.addServer("test-server", mockConfig.servers["test-server"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await inspectServer("test-server");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: { tools: number; resources: number; prompts: number } };
    assertEquals(output.data.tools, 3);
    assertEquals(output.data.resources, 3);
    assertEquals(output.data.prompts, 2);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("inspectServer - handles error", async () => {
  setup();

  try {
    mockConfig.servers = {
      "test-server": { type: "stdio", command: "test", enabled: true },
    };

    const mockClient = new MockMCPClient();
    mockClient.setErrorOnOperation("listTools");

    clientPool.addServer("test-server", mockConfig.servers["test-server"]);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await inspectServer("test-server");

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("addServer - disabled server", async () => {
  setup();

  try {
    await addServer("new-server", {
      name: "new-server",
      type: "stdio",
      command: "test",
      enabled: false,
    });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { success: boolean };
    assertEquals(output.success, true);

    const config = mockConfig.servers["new-server"] as StdioServerConfig;
    assertEquals(config.enabled, false);
  } finally {
    teardown();
  }
});

Deno.test("listServers - handles errors gracefully", async () => {
  setup();

  try {
    // Override getConfig to throw
    configLoader.getConfig = async () => {
      throw new Error("Config load failed");
    };

    await listServers({ namesOnly: true });

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);
  } finally {
    teardown();
  }
});

Deno.test("initConfig - creates global config by default", async () => {
  setup();

  try {
    const testConfigPath = "./tests/fixtures/test-global-config.json";

    // Mock Platform.getConfigPath to return test path
    const originalGetConfigPath = Platform.getConfigPath;
    Platform.getConfigPath = () => testConfigPath;

    await initConfig({});

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { success: boolean; data: { path: string; type: string } };
    assertEquals(output.success, true);
    assertEquals(output.data.type, "global");
    assertEquals(output.data.path.includes("test-global-config.json"), true);

    // Verify file was created
    const exists = await Platform.fileExists(testConfigPath);
    assertEquals(exists, true);

    // Cleanup
    await Deno.remove(testConfigPath);
    Platform.getConfigPath = originalGetConfigPath;
  } finally {
    teardown();
  }
});

Deno.test("initConfig - creates local config when --local is specified", async () => {
  setup();

  try {
    await initConfig({ local: true });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { success: boolean; data: { path: string; type: string } };
    assertEquals(output.success, true);
    assertEquals(output.data.type, "local");

    // Note: The actual path will be relative to cwd, not the test path
    // Just verify the type is correct
  } finally {
    teardown();
    // Cleanup if file was created in cwd
    try {
      await Deno.remove("./.mcp-cli.json");
    } catch {
      // Ignore if not exists
    }
  }
});

Deno.test("initConfig - creates config at custom path", async () => {
  setup();

  try {
    const testConfigPath = "./tests/fixtures/custom-mcp-config.json";

    await initConfig({ path: testConfigPath });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { success: boolean; data: { path: string } };
    assertEquals(output.success, true);
    assertEquals(output.data.path.includes("custom-mcp-config.json"), true);

    // Verify file was created
    const exists = await Platform.fileExists(testConfigPath);
    assertEquals(exists, true);

    // Cleanup
    await Deno.remove(testConfigPath);
  } finally {
    teardown();
  }
});

Deno.test("initConfig - fails if config exists without --force", async () => {
  setup();

  try {
    const testConfigPath = "./tests/fixtures/existing-config.json";

    // Create existing config
    await Deno.writeTextFile(testConfigPath, "{}");

    await initConfig({ path: testConfigPath });

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { success: boolean; error: { message: string } };
    assertEquals(output.success, false);
    assertEquals(output.error.message.includes("already exists"), true);

    // Cleanup
    await Deno.remove(testConfigPath);
  } finally {
    teardown();
  }
});

Deno.test("initConfig - overwrites existing config with --force", async () => {
  setup();

  try {
    const testConfigPath = "./tests/fixtures/force-config.json";

    // Create existing config
    await Deno.writeTextFile(testConfigPath, '{"old": "data"}');

    await initConfig({ path: testConfigPath, force: true });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { success: boolean };
    assertEquals(output.success, true);

    // Verify file was overwritten with new config
    const content = await Deno.readTextFile(testConfigPath);
    const config = JSON.parse(content);
    assertEquals(config.servers, {});
    assertExists(config.preferences);

    // Cleanup
    await Deno.remove(testConfigPath);
  } finally {
    teardown();
  }
});
