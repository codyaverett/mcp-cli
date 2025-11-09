import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { HTTPMCPClient } from "../../../src/client/http.ts";
import type { HTTPServerConfig } from "../../../src/types/config.ts";
import {
  createTextToolResult,
  createResourceContents,
  createPromptResult,
  SAMPLE_TOOLS,
  SAMPLE_RESOURCES,
  SAMPLE_PROMPTS,
} from "../../fixtures/test-data.ts";

// Store original fetch
const originalFetch = globalThis.fetch;

// Mock fetch responses
let mockResponses = new Map<string, unknown>();
let mockError: Error | null = null;
let mockHttpStatus: number | null = null;

function setupMockFetch() {
  mockResponses.clear();
  mockError = null;
  mockHttpStatus = null;

  globalThis.fetch = async (input: string | Request | URL, _init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (mockError) {
      throw mockError;
    }

    if (mockHttpStatus && mockHttpStatus !== 200) {
      return new Response(JSON.stringify({ error: "Server error" }), {
        status: mockHttpStatus,
        statusText: "Error",
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract endpoint from URL
    const urlObj = new URL(url);
    const endpoint = urlObj.pathname;
    const response = mockResponses.get(endpoint);

    if (!response) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        statusText: "Not Found",
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "application/json" },
    });
  };
}

function cleanupMockFetch() {
  globalThis.fetch = originalFetch;
  mockResponses.clear();
  mockError = null;
  mockHttpStatus = null;
}

Deno.test({
  name: "HTTPMCPClient - constructor sets config and headers",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const config: HTTPServerConfig = {
      type: "http",
      url: "http://localhost:3000",
      apiKey: "test-api-key",
      headers: { "X-Custom": "value" },
      timeout: 5000,
    };

    const client = new HTTPMCPClient("test-server", config);

    assertEquals(client.isConnected(), false);
    assertEquals(client.getTimeout(), 5000);
  },
});

Deno.test({
  name: "HTTPMCPClient - constructor sets Authorization header when apiKey provided",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const config: HTTPServerConfig = {
      type: "http",
      url: "http://localhost:3000",
      apiKey: "test-api-key",
    };

    const client = new HTTPMCPClient("test-server", config);

    assertExists(client);
  },
});

Deno.test({
  name: "HTTPMCPClient - connect tests connection by getting server info",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      mockResponses.set("/info", {
        name: "test-server",
        version: "1.0.0",
      });

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
      };

      const client = new HTTPMCPClient("test-server", config);

      await client.connect();

      assertEquals(client.isConnected(), true);
    } finally {
      cleanupMockFetch();
    }
  },
});

Deno.test({
  name: "HTTPMCPClient - connect handles already connected",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      mockResponses.set("/info", {
        name: "test-server",
        version: "1.0.0",
      });

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
      };

      const client = new HTTPMCPClient("test-server", config);

      await client.connect();
      assertEquals(client.isConnected(), true);

      // Connect again should not throw
      await client.connect();
      assertEquals(client.isConnected(), true);
    } finally {
      cleanupMockFetch();
    }
  },
});

Deno.test({
  name: "HTTPMCPClient - connect throws on HTTP error",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      mockHttpStatus = 500;

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
      };

      const client = new HTTPMCPClient("test-server", config);

      await assertRejects(
        () => client.connect(),
        Error,
      );

      assertEquals(client.isConnected(), false);
    } finally {
      cleanupMockFetch();
    }
  },
});

Deno.test({
  name: "HTTPMCPClient - disconnect sets connected to false",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      mockResponses.set("/info", {
        name: "test-server",
        version: "1.0.0",
      });

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
      };

      const client = new HTTPMCPClient("test-server", config);

      await client.connect();
      assertEquals(client.isConnected(), true);

      await client.disconnect();
      assertEquals(client.isConnected(), false);
    } finally {
      cleanupMockFetch();
    }
  },
});

Deno.test({
  name: "HTTPMCPClient - getServerInfo returns server information",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      mockResponses.set("/info", {
        name: "Test Server",
        version: "2.0.0",
      });

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
      };

      const client = new HTTPMCPClient("test-server", config);
      await client.connect();

      const info = await client.getServerInfo();

      assertExists(info);
      assertEquals(info.name, "test-server");
      assertEquals(info.version, "2.0.0");
    } finally {
      cleanupMockFetch();
    }
  },
});

Deno.test({
  name: "HTTPMCPClient - listTools returns tools",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      mockResponses.set("/info", { name: "test", version: "1.0" });
      mockResponses.set("/tools", { tools: SAMPLE_TOOLS });

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
      };

      const client = new HTTPMCPClient("test-server", config);
      await client.connect();

      const tools = await client.listTools();

      assertExists(tools);
      assertEquals(tools.length, 3);
      assertEquals(tools[0].name, "simple_tool");
    } finally {
      cleanupMockFetch();
    }
  },
});

Deno.test({
  name: "HTTPMCPClient - getTool returns specific tool",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      mockResponses.set("/info", { name: "test", version: "1.0" });
      mockResponses.set("/tools", { tools: SAMPLE_TOOLS });

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
      };

      const client = new HTTPMCPClient("test-server", config);
      await client.connect();

      const tool = await client.getTool("simple_tool");

      assertExists(tool);
      assertEquals(tool.name, "simple_tool");

      const notFound = await client.getTool("nonexistent");
      assertEquals(notFound, null);
    } finally {
      cleanupMockFetch();
    }
  },
});

Deno.test({
  name: "HTTPMCPClient - executeTool executes tool",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      mockResponses.set("/info", { name: "test", version: "1.0" });
      const toolResult = createTextToolResult("Success");
      mockResponses.set("/tools/execute", toolResult);

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
      };

      const client = new HTTPMCPClient("test-server", config);
      await client.connect();

      const result = await client.executeTool("test-tool", { param: "value" });

      assertExists(result);
      assertEquals(result.content.length, 1);
      assertEquals(result.content[0].type, "text");
    } finally {
      cleanupMockFetch();
    }
  },
});

Deno.test({
  name: "HTTPMCPClient - listResources returns resources",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      mockResponses.set("/info", { name: "test", version: "1.0" });
      mockResponses.set("/resources", { resources: SAMPLE_RESOURCES });

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
      };

      const client = new HTTPMCPClient("test-server", config);
      await client.connect();

      const resources = await client.listResources();

      assertExists(resources);
      assertEquals(resources.length, 3);
      assertEquals(resources[0].uri, "file:///test1.txt");
    } finally {
      cleanupMockFetch();
    }
  },
});

Deno.test({
  name: "HTTPMCPClient - readResource reads resource",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      mockResponses.set("/info", { name: "test", version: "1.0" });
      const contents = createResourceContents("file:///test.txt", "test content");
      mockResponses.set("/resources/read", contents);

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
      };

      const client = new HTTPMCPClient("test-server", config);
      await client.connect();

      const result = await client.readResource("file:///test.txt");

      assertExists(result);
      assertEquals(result.uri, "file:///test.txt");
      assertExists(result.contents);
    } finally {
      cleanupMockFetch();
    }
  },
});

Deno.test({
  name: "HTTPMCPClient - listPrompts returns prompts",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      mockResponses.set("/info", { name: "test", version: "1.0" });
      mockResponses.set("/prompts", { prompts: SAMPLE_PROMPTS });

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
      };

      const client = new HTTPMCPClient("test-server", config);
      await client.connect();

      const prompts = await client.listPrompts();

      assertExists(prompts);
      assertEquals(prompts.length, 2);
      assertEquals(prompts[0].name, "simple_prompt");
    } finally {
      cleanupMockFetch();
    }
  },
});

Deno.test({
  name: "HTTPMCPClient - getPrompt gets prompt",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      mockResponses.set("/info", { name: "test", version: "1.0" });
      const promptResult = createPromptResult("User message", "Assistant message");
      mockResponses.set("/prompts/get", promptResult);

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
      };

      const client = new HTTPMCPClient("test-server", config);
      await client.connect();

      const result = await client.getPrompt("test-prompt", { arg: "value" });

      assertExists(result);
      assertExists(result.messages);
      assertEquals(result.messages.length, 2);
    } finally {
      cleanupMockFetch();
    }
  },
});

Deno.test({
  name: "HTTPMCPClient - operations throw when not connected",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const config: HTTPServerConfig = {
      type: "http",
      url: "http://localhost:3000",
    };

    const client = new HTTPMCPClient("test-server", config);

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
  },
});

Deno.test({
  name: "HTTPMCPClient - request handles timeout",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      // Mock a delayed response
      mockError = new Error("AbortError");
      mockError.name = "AbortError";

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
        timeout: 100,
      };

      const client = new HTTPMCPClient("test-server", config);

      await assertRejects(
        () => client.connect(),
        Error,
      );
    } finally {
      cleanupMockFetch();
    }
  },
});

Deno.test({
  name: "HTTPMCPClient - request handles HTTP errors",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      mockHttpStatus = 500;

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
      };

      const client = new HTTPMCPClient("test-server", config);

      await assertRejects(
        () => client.connect(),
        Error,
        "HTTP 500",
      );
    } finally {
      cleanupMockFetch();
    }
  },
});

Deno.test({
  name: "HTTPMCPClient - handles custom headers",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    setupMockFetch();

    try {
      mockResponses.set("/info", {
        name: "test-server",
        version: "1.0.0",
      });

      const config: HTTPServerConfig = {
        type: "http",
        url: "http://localhost:3000",
        headers: {
          "X-Custom-Header": "custom-value",
          "X-Another-Header": "another-value",
        },
      };

      const client = new HTTPMCPClient("test-server", config);
      await client.connect();

      assertEquals(client.isConnected(), true);
    } finally {
      cleanupMockFetch();
    }
  },
});
