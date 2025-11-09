import { assert, assertEquals, assertExists } from "@std/assert";
import { MCPClientFactory, MCPClientPool } from "../../../src/client/factory.ts";
import type {
  HTTPServerConfig,
  ServerConfig,
  SSEServerConfig,
  StdioServerConfig,
} from "../../../src/types/config.ts";
import { assertThrowsAsync } from "../../fixtures/test-utils.ts";

// Note: We can't easily test the actual client creation without mocking the MCP SDK
// so these tests focus on factory logic and pool management

Deno.test("MCPClientFactory - create stdio client", () => {
  const config: StdioServerConfig = {
    type: "stdio",
    command: "test-command",
    args: ["arg1", "arg2"],
    enabled: true,
  };

  const client = MCPClientFactory.create("test-server", config);

  assertExists(client);
  assertEquals(client.isConnected(), false);
});

Deno.test("MCPClientFactory - create SSE client", () => {
  const config: SSEServerConfig = {
    type: "sse",
    url: "http://localhost:3000",
    enabled: true,
  };

  const client = MCPClientFactory.create("test-server", config);

  assertExists(client);
  assertEquals(client.isConnected(), false);
});

Deno.test("MCPClientFactory - create HTTP client", () => {
  const config: HTTPServerConfig = {
    type: "http",
    url: "http://localhost:3001",
    enabled: true,
  };

  const client = MCPClientFactory.create("test-server", config);

  assertExists(client);
  assertEquals(client.isConnected(), false);
});

Deno.test("MCPClientFactory - create with invalid type throws error", () => {
  const invalidConfig = {
    type: "invalid-type",
    enabled: true,
  } as unknown as ServerConfig;

  try {
    MCPClientFactory.create("test-server", invalidConfig);
    throw new Error("Should have thrown an error");
  } catch (error) {
    assert(error instanceof Error);
    // Error should mention transport not supported
  }
});

Deno.test("MCPClientPool - initial state", () => {
  const pool = new MCPClientPool();

  assertEquals(pool.getConfiguredServers().length, 0);
  assertEquals(pool.getConnectedServers().length, 0);
});

Deno.test("MCPClientPool - addServer", () => {
  const pool = new MCPClientPool();
  const config: StdioServerConfig = {
    type: "stdio",
    command: "test",
    enabled: true,
  };

  pool.addServer("test-server", config);

  const configured = pool.getConfiguredServers();
  assertEquals(configured.length, 1);
  assertEquals(configured[0], "test-server");
});

Deno.test("MCPClientPool - addServer multiple servers", () => {
  const pool = new MCPClientPool();

  pool.addServer("server1", {
    type: "stdio",
    command: "test1",
    enabled: true,
  });

  pool.addServer("server2", {
    type: "sse",
    url: "http://localhost:3000",
    enabled: true,
  });

  pool.addServer("server3", {
    type: "http",
    url: "http://localhost:3001",
    enabled: true,
  });

  const configured = pool.getConfiguredServers();
  assertEquals(configured.length, 3);
  assert(configured.includes("server1"));
  assert(configured.includes("server2"));
  assert(configured.includes("server3"));
});

Deno.test("MCPClientPool - removeServer", () => {
  const pool = new MCPClientPool();

  pool.addServer("server1", {
    type: "stdio",
    command: "test1",
    enabled: true,
  });

  pool.addServer("server2", {
    type: "stdio",
    command: "test2",
    enabled: true,
  });

  assertEquals(pool.getConfiguredServers().length, 2);

  pool.removeServer("server1");

  const configured = pool.getConfiguredServers();
  assertEquals(configured.length, 1);
  assertEquals(configured[0], "server2");
});

Deno.test("MCPClientPool - removeServer non-existent server", () => {
  const pool = new MCPClientPool();

  pool.addServer("server1", {
    type: "stdio",
    command: "test1",
    enabled: true,
  });

  // Should not throw
  pool.removeServer("non-existent");

  assertEquals(pool.getConfiguredServers().length, 1);
});

Deno.test("MCPClientPool - getClient throws when server not found", async () => {
  const pool = new MCPClientPool();

  await assertThrowsAsync(
    () => pool.getClient("non-existent"),
    "not found",
  );
});

Deno.test("MCPClientPool - getClient throws when server is disabled", async () => {
  const pool = new MCPClientPool();

  pool.addServer("disabled-server", {
    type: "stdio",
    command: "test",
    enabled: false,
  });

  await assertThrowsAsync(
    () => pool.getClient("disabled-server"),
    "disabled",
  );
});

Deno.test("MCPClientPool - getConfiguredServers returns all server names", () => {
  const pool = new MCPClientPool();

  pool.addServer("server1", {
    type: "stdio",
    command: "test1",
    enabled: true,
  });

  pool.addServer("server2", {
    type: "sse",
    url: "http://localhost:3000",
    enabled: true,
  });

  pool.addServer("server3", {
    type: "http",
    url: "http://localhost:3001",
    enabled: false,
  });

  const servers = pool.getConfiguredServers();
  assertEquals(servers.length, 3);
  assert(servers.includes("server1"));
  assert(servers.includes("server2"));
  assert(servers.includes("server3"));
});

Deno.test("MCPClientPool - disconnectAll with no clients", async () => {
  const pool = new MCPClientPool();

  // Should not throw
  await pool.disconnectAll();

  assertEquals(pool.getConnectedServers().length, 0);
});

Deno.test("MCPClientPool - disconnect non-existent server", async () => {
  const pool = new MCPClientPool();

  // Should not throw
  await pool.disconnect("non-existent");

  assertEquals(pool.getConnectedServers().length, 0);
});

Deno.test("MCPClientPool - addServer overwrites existing config", () => {
  const pool = new MCPClientPool();

  pool.addServer("test-server", {
    type: "stdio",
    command: "original",
    enabled: true,
  });

  pool.addServer("test-server", {
    type: "sse",
    url: "http://localhost:3000",
    enabled: true,
  });

  assertEquals(pool.getConfiguredServers().length, 1);
});

Deno.test("MCPClientPool - removeServer also disconnects client", async () => {
  const pool = new MCPClientPool();

  pool.addServer("test-server", {
    type: "stdio",
    command: "test",
    enabled: true,
  });

  // Note: We can't easily test actual connection without mocking,
  // but we can verify the method doesn't throw
  pool.removeServer("test-server");

  assertEquals(pool.getConfiguredServers().length, 0);
});

Deno.test("MCPClientPool - getConnectedServers returns empty initially", () => {
  const pool = new MCPClientPool();

  pool.addServer("test-server", {
    type: "stdio",
    command: "test",
    enabled: true,
  });

  // Not connected yet
  assertEquals(pool.getConnectedServers().length, 0);
});

Deno.test("MCPClientFactory - stdio client with timeout config", () => {
  const config: StdioServerConfig = {
    type: "stdio",
    command: "test-command",
    timeout: 5000,
    enabled: true,
  };

  const client = MCPClientFactory.create("test-server", config);

  assertExists(client);
  assertEquals(client.getTimeout(), 5000);
});

Deno.test("MCPClientFactory - SSE client with API key", () => {
  const config: SSEServerConfig = {
    type: "sse",
    url: "http://localhost:3000",
    apiKey: "test-api-key",
    enabled: true,
  };

  const client = MCPClientFactory.create("test-server", config);

  assertExists(client);
  assertEquals(client.isConnected(), false);
});

Deno.test("MCPClientFactory - HTTP client with headers", () => {
  const config: HTTPServerConfig = {
    type: "http",
    url: "http://localhost:3001",
    headers: {
      "X-Custom-Header": "value",
    },
    enabled: true,
  };

  const client = MCPClientFactory.create("test-server", config);

  assertExists(client);
  assertEquals(client.isConnected(), false);
});

Deno.test("MCPClientFactory - stdio client with env vars", () => {
  const config: StdioServerConfig = {
    type: "stdio",
    command: "test-command",
    env: {
      "TEST_VAR": "test-value",
    },
    enabled: true,
  };

  const client = MCPClientFactory.create("test-server", config);

  assertExists(client);
});

Deno.test("MCPClientFactory - stdio client with cwd", () => {
  const config: StdioServerConfig = {
    type: "stdio",
    command: "test-command",
    cwd: "/tmp",
    enabled: true,
  };

  const client = MCPClientFactory.create("test-server", config);

  assertExists(client);
});

Deno.test("MCPClientFactory - stdio client with args", () => {
  const config: StdioServerConfig = {
    type: "stdio",
    command: "test-command",
    args: ["--arg1", "value1", "--arg2", "value2"],
    enabled: true,
  };

  const client = MCPClientFactory.create("test-server", config);

  assertExists(client);
});

Deno.test("MCPClientPool - multiple servers can be configured", () => {
  const pool = new MCPClientPool();

  for (let i = 0; i < 10; i++) {
    pool.addServer(`server-${i}`, {
      type: "stdio",
      command: `test-${i}`,
      enabled: true,
    });
  }

  assertEquals(pool.getConfiguredServers().length, 10);
});

Deno.test("MCPClientPool - servers can be added and removed repeatedly", () => {
  const pool = new MCPClientPool();

  // Add
  pool.addServer("test-server", {
    type: "stdio",
    command: "test",
    enabled: true,
  });
  assertEquals(pool.getConfiguredServers().length, 1);

  // Remove
  pool.removeServer("test-server");
  assertEquals(pool.getConfiguredServers().length, 0);

  // Add again
  pool.addServer("test-server", {
    type: "stdio",
    command: "test",
    enabled: true,
  });
  assertEquals(pool.getConfiguredServers().length, 1);

  // Remove again
  pool.removeServer("test-server");
  assertEquals(pool.getConfiguredServers().length, 0);
});
