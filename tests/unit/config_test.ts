import { assertEquals, assertExists } from "@std/assert";
import { ConfigLoader } from "../../src/config/loader.ts";
import { ConfigValidator } from "../../src/config/validator.ts";
import type { Config, StdioServerConfig } from "../../src/types/config.ts";

const TEST_CONFIG_PATH = "./tests/fixtures/test-config-unit.json";

Deno.test("ConfigLoader - save and load", async () => {
  const loader = new ConfigLoader(TEST_CONFIG_PATH);

  const testConfig: Config = {
    servers: {
      "test-server": {
        type: "stdio",
        command: "test",
        args: ["arg1", "arg2"],
        enabled: true,
      },
    },
    preferences: {
      defaultTimeout: 5000,
      cacheSchemas: true,
    },
  };

  await loader.save(testConfig);

  const loaded = await loader.load();

  assertEquals(loaded.servers["test-server"].type, "stdio");
  assertEquals((loaded.servers["test-server"] as StdioServerConfig).command, "test");
  assertExists(loaded.preferences);
  assertEquals(loaded.preferences?.defaultTimeout, 5000);

  // Cleanup
  await Deno.remove(TEST_CONFIG_PATH);
});

Deno.test("ConfigLoader - environment variable substitution", async () => {
  const loader = new ConfigLoader(TEST_CONFIG_PATH);

  // Set test env var
  Deno.env.set("TEST_API_KEY", "secret-key-123");

  const testConfig: Config = {
    servers: {
      "test-server": {
        type: "sse",
        url: "http://localhost:3000",
        apiKey: "${TEST_API_KEY}",
        enabled: true,
      },
    },
  };

  await loader.save(testConfig);

  const loaded = await loader.load();
  const server = loaded.servers["test-server"] as { apiKey?: string };

  assertEquals(server.apiKey, "secret-key-123");

  // Cleanup
  Deno.env.delete("TEST_API_KEY");
  await Deno.remove(TEST_CONFIG_PATH);
});

Deno.test("ConfigLoader - getServer", async () => {
  const loader = new ConfigLoader(TEST_CONFIG_PATH);

  const testConfig: Config = {
    servers: {
      "test-server": {
        type: "stdio",
        command: "test",
        enabled: true,
      },
    },
  };

  await loader.save(testConfig);

  const server = await loader.getServer("test-server");
  assertExists(server);
  assertEquals(server.type, "stdio");

  // Cleanup
  await Deno.remove(TEST_CONFIG_PATH);
});

Deno.test("ConfigLoader - setServer", async () => {
  const loader = new ConfigLoader(TEST_CONFIG_PATH);

  await loader.save({ servers: {} });

  const serverConfig: StdioServerConfig = {
    type: "stdio",
    command: "new-server",
    enabled: true,
  };

  await loader.setServer("new-server", serverConfig);

  const config = await loader.load();
  assertExists(config.servers["new-server"]);

  // Cleanup
  await Deno.remove(TEST_CONFIG_PATH);
});

Deno.test("ConfigLoader - removeServer", async () => {
  const loader = new ConfigLoader(TEST_CONFIG_PATH);

  const testConfig: Config = {
    servers: {
      "server1": {
        type: "stdio",
        command: "test1",
        enabled: true,
      },
      "server2": {
        type: "stdio",
        command: "test2",
        enabled: true,
      },
    },
  };

  await loader.save(testConfig);

  await loader.removeServer("server1");

  const config = await loader.load();
  assertEquals(config.servers["server1"], undefined);
  assertExists(config.servers["server2"]);

  // Cleanup
  await Deno.remove(TEST_CONFIG_PATH);
});

Deno.test("ConfigLoader - listServers", async () => {
  const loader = new ConfigLoader(TEST_CONFIG_PATH);

  const testConfig: Config = {
    servers: {
      "server1": {
        type: "stdio",
        command: "test1",
        enabled: true,
      },
      "server2": {
        type: "stdio",
        command: "test2",
        enabled: true,
      },
    },
  };

  await loader.save(testConfig);

  const servers = await loader.listServers();
  assertEquals(servers.length, 2);
  assertEquals(servers.includes("server1"), true);
  assertEquals(servers.includes("server2"), true);

  // Cleanup
  await Deno.remove(TEST_CONFIG_PATH);
});

Deno.test("ConfigValidator - validateServerConfig", () => {
  const validConfig: StdioServerConfig = {
    type: "stdio",
    command: "test",
    enabled: true,
  };

  const validated = ConfigValidator.validateServerConfig(validConfig);
  assertExists(validated);
  assertEquals(validated.type, "stdio");
});

Deno.test("ConfigValidator - validateTimeout", () => {
  let error: Error | null = null;

  try {
    ConfigValidator.validateTimeout(0);
  } catch (e) {
    error = e as Error;
  }

  assertExists(error);
});

Deno.test("ConfigValidator - validateRetries", () => {
  let error: Error | null = null;

  try {
    ConfigValidator.validateRetries(-1);
  } catch (e) {
    error = e as Error;
  }

  assertExists(error);
});
