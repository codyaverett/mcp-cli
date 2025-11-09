import { assertEquals, assertExists } from "@std/assert";
import { ConfigLoader } from "../../src/config/loader.ts";
import { clientPool } from "../../src/client/factory.ts";
import type { StdioServerConfig } from "../../src/types/config.ts";

/**
 * Integration tests using Playwright MCP server
 * These tests require the Playwright MCP server to be available via npx
 */

const TEST_SERVER_NAME = "playwright-test";
const TEST_CONFIG_PATH = "./tests/fixtures/test-config.json";

Deno.test({
  name: "Playwright MCP Server Integration",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const configLoader = new ConfigLoader(TEST_CONFIG_PATH);

    await t.step("setup: create test config with Playwright server", async () => {
      const testConfig = {
        servers: {
          [TEST_SERVER_NAME]: {
            type: "stdio" as const,
            command: "npx",
            args: ["-y", "@playwright/mcp@latest"],
            enabled: true,
          } as StdioServerConfig,
        },
        preferences: {
          defaultTimeout: 30000,
          cacheSchemas: true,
        },
      };

      await configLoader.save(testConfig);

      // Add to client pool
      const config = await configLoader.getConfig();
      for (const [name, serverConfig] of Object.entries(config.servers)) {
        clientPool.addServer(name, serverConfig);
      }
    });

    await t.step("should connect to Playwright server", async () => {
      const client = await clientPool.getClient(TEST_SERVER_NAME);
      assertExists(client);
      assertEquals(client.isConnected(), true);
    });

    await t.step("should get server info", async () => {
      const client = await clientPool.getClient(TEST_SERVER_NAME);
      const info = await client.getServerInfo();

      assertExists(info);
      assertExists(info.name);
      assertExists(info.version);
    });

    await t.step("should list tools", async () => {
      const client = await clientPool.getClient(TEST_SERVER_NAME);
      const tools = await client.listTools();

      assertExists(tools);
      assertEquals(Array.isArray(tools), true);
      assertEquals(tools.length > 0, true);

      // Playwright MCP server should have these tools (updated API)
      const toolNames = tools.map((t) => t.name);
      assertEquals(toolNames.includes("browser_navigate"), true);
      assertEquals(toolNames.includes("browser_take_screenshot"), true);
      assertEquals(toolNames.includes("browser_click"), true);
    });

    await t.step("should get specific tool schema", async () => {
      const client = await clientPool.getClient(TEST_SERVER_NAME);
      const tool = await client.getTool("browser_navigate");

      assertExists(tool);
      assertEquals(tool.name, "browser_navigate");
      assertExists(tool.inputSchema);
      assertExists(tool.inputSchema.properties);
    });

    await t.step("should execute browser_navigate tool", async () => {
      const client = await clientPool.getClient(TEST_SERVER_NAME);

      const result = await client.executeTool("browser_navigate", {
        url: "https://example.com",
      });

      assertExists(result);
      assertExists(result.content);
      assertEquals(Array.isArray(result.content), true);
    });

    await t.step("should list resources", async () => {
      const client = await clientPool.getClient(TEST_SERVER_NAME);

      try {
        const resources = await client.listResources();
        assertExists(resources);
        assertEquals(Array.isArray(resources), true);
      } catch (error) {
        // Playwright server may not support resources - skip if not supported
        if (error instanceof Error && error.message.includes("Method not found")) {
          console.log("Playwright server does not support listResources - skipping");
        } else {
          throw error;
        }
      }
    });

    await t.step("should list prompts", async () => {
      const client = await clientPool.getClient(TEST_SERVER_NAME);

      try {
        const prompts = await client.listPrompts();
        assertExists(prompts);
        assertEquals(Array.isArray(prompts), true);
      } catch (error) {
        // Playwright server may not support prompts - skip if not supported
        if (error instanceof Error && error.message.includes("Method not found")) {
          console.log("Playwright server does not support listPrompts - skipping");
        } else {
          throw error;
        }
      }
    });

    await t.step("cleanup: disconnect and remove config", async () => {
      await clientPool.disconnect(TEST_SERVER_NAME);

      try {
        await Deno.remove(TEST_CONFIG_PATH);
      } catch {
        // Ignore if file doesn't exist
      }
    });
  },
});

Deno.test({
  name: "Progressive Disclosure with Playwright Server",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const configLoader = new ConfigLoader(TEST_CONFIG_PATH);

    await t.step("setup", async () => {
      const testConfig = {
        servers: {
          [TEST_SERVER_NAME]: {
            type: "stdio" as const,
            command: "npx",
            args: ["-y", "@playwright/mcp@latest"],
            enabled: true,
          } as StdioServerConfig,
        },
      };

      await configLoader.save(testConfig);

      const config = await configLoader.getConfig();
      for (const [name, serverConfig] of Object.entries(config.servers)) {
        clientPool.addServer(name, serverConfig);
      }
    });

    await t.step("names-only mode should return minimal data", async () => {
      const client = await clientPool.getClient(TEST_SERVER_NAME);
      const tools = await client.listTools();
      const names = tools.map((t) => t.name);

      // Just names, no schemas
      assertExists(names);
      assertEquals(Array.isArray(names), true);

      // Estimate token count (roughly 4 chars per token)
      const namesJson = JSON.stringify(names);
      const estimatedTokens = Math.ceil(namesJson.length / 4);

      // Should be much less than loading full schemas
      assertEquals(estimatedTokens < 500, true);
    });

    await t.step("brief mode should include descriptions", async () => {
      const client = await clientPool.getClient(TEST_SERVER_NAME);
      const tools = await client.listTools();
      const brief = tools.map((t) => ({
        name: t.name,
        description: t.description,
      }));

      assertExists(brief);
      assertEquals(Array.isArray(brief), true);

      const briefJson = JSON.stringify(brief);
      const estimatedTokens = Math.ceil(briefJson.length / 4);

      // Should be more than names-only but less than full
      assertEquals(estimatedTokens < 2000, true);
    });

    await t.step("just-in-time schema loading", async () => {
      const client = await clientPool.getClient(TEST_SERVER_NAME);

      // Load only the specific tool we need
      const tool = await client.getTool("browser_take_screenshot");

      assertExists(tool);
      assertExists(tool.inputSchema);

      // Single tool schema should be small
      const toolJson = JSON.stringify(tool);
      const estimatedTokens = Math.ceil(toolJson.length / 4);

      assertEquals(estimatedTokens < 500, true);
    });

    await t.step("cleanup", async () => {
      await clientPool.disconnect(TEST_SERVER_NAME);

      try {
        await Deno.remove(TEST_CONFIG_PATH);
      } catch {
        // Ignore
      }
    });
  },
});
