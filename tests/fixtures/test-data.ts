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
 * Sample server info for testing
 */
export const SAMPLE_SERVER_INFO: ServerInfo = {
  name: "test-server",
  version: "1.0.0",
  protocolVersion: "1.0",
  capabilities: {
    tools: {
      listChanged: true,
    },
    resources: {
      subscribe: false,
      listChanged: true,
    },
    prompts: {
      listChanged: false,
    },
  },
  serverInfo: {
    name: "Test MCP Server",
    version: "1.0.0",
  },
};

/**
 * Sample tools for testing
 */
export const SAMPLE_TOOLS: Tool[] = [
  {
    name: "simple_tool",
    description: "A simple tool with no parameters",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "complex_tool",
    description: "A complex tool with many parameters",
    inputSchema: {
      type: "object",
      properties: {
        stringParam: {
          type: "string",
          description: "A string parameter",
        },
        numberParam: {
          type: "number",
          description: "A number parameter",
        },
        booleanParam: {
          type: "boolean",
          description: "A boolean parameter",
        },
        arrayParam: {
          type: "array",
          description: "An array parameter",
          items: {
            type: "string",
          },
        },
        objectParam: {
          type: "object",
          description: "An object parameter",
          properties: {
            nested: {
              type: "string",
            },
          },
        },
        enumParam: {
          type: "string",
          description: "An enum parameter",
          enum: ["option1", "option2", "option3"],
        },
      },
      required: ["stringParam", "numberParam"],
    },
  },
  {
    name: "no_description_tool",
    inputSchema: {
      type: "object",
      properties: {
        param: {
          type: "string",
        },
      },
    },
  },
];

/**
 * Sample tool results for testing
 */
export const SAMPLE_TOOL_RESULTS: Record<string, ToolResult> = {
  simple_tool: {
    content: [
      {
        type: "text",
        text: "Simple tool executed successfully",
      },
    ],
  },
  complex_tool: {
    content: [
      {
        type: "text",
        text: "Complex tool executed with parameters",
      },
    ],
  },
  error_tool: {
    content: [
      {
        type: "text",
        text: "Tool execution failed",
      },
    ],
    isError: true,
  },
  image_tool: {
    content: [
      {
        type: "image",
        data: "base64-encoded-image-data",
        mimeType: "image/png",
      },
    ],
  },
  resource_tool: {
    content: [
      {
        type: "resource",
        resource: {
          uri: "file:///example.txt",
          text: "Resource content",
          mimeType: "text/plain",
        },
      },
    ],
  },
};

/**
 * Sample resources for testing
 */
export const SAMPLE_RESOURCES: Resource[] = [
  {
    uri: "file:///test1.txt",
    name: "test1.txt",
    description: "Test file 1",
    mimeType: "text/plain",
  },
  {
    uri: "file:///test2.json",
    name: "test2.json",
    description: "Test JSON file",
    mimeType: "application/json",
  },
  {
    uri: "https://example.com/resource",
    name: "remote-resource",
    description: "A remote resource",
  },
];

/**
 * Sample resource contents for testing
 */
export const SAMPLE_RESOURCE_CONTENTS: Record<string, ResourceContents> = {
  "file:///test1.txt": {
    uri: "file:///test1.txt",
    contents: [
      {
        type: "resource",
        resource: {
          uri: "file:///test1.txt",
          text: "This is test file 1 content",
          mimeType: "text/plain",
        },
      },
    ],
  },
  "file:///test2.json": {
    uri: "file:///test2.json",
    contents: [
      {
        type: "resource",
        resource: {
          uri: "file:///test2.json",
          text: '{"key": "value"}',
          mimeType: "application/json",
        },
      },
    ],
  },
};

/**
 * Sample prompts for testing
 */
export const SAMPLE_PROMPTS: Prompt[] = [
  {
    name: "simple_prompt",
    description: "A simple prompt with no arguments",
  },
  {
    name: "complex_prompt",
    description: "A complex prompt with arguments",
    arguments: [
      {
        name: "topic",
        description: "The topic to discuss",
        required: true,
      },
      {
        name: "style",
        description: "The writing style",
        required: false,
      },
    ],
  },
];

/**
 * Sample prompt results for testing
 */
export const SAMPLE_PROMPT_RESULTS: Record<string, PromptResult> = {
  simple_prompt: {
    description: "Simple prompt result",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Execute simple prompt",
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: "Simple prompt response",
        },
      },
    ],
  },
  complex_prompt: {
    description: "Complex prompt with topic and style",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Write about AI in a formal style",
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: "Artificial Intelligence represents...",
        },
      },
    ],
  },
};

/**
 * Create a minimal server info for testing
 */
export function createMinimalServerInfo(name: string): ServerInfo {
  return {
    name,
    version: "1.0.0",
  };
}

/**
 * Create a simple tool for testing
 */
export function createSimpleTool(name: string, description?: string): Tool {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties: {},
    },
  };
}

/**
 * Create a tool with parameters for testing
 */
export function createToolWithParams(
  name: string,
  params: Record<string, { type: string; description?: string }>,
  required: string[] = [],
): Tool {
  return {
    name,
    description: `Tool ${name} with parameters`,
    inputSchema: {
      type: "object",
      properties: params,
      required,
    },
  };
}

/**
 * Create a text tool result for testing
 */
export function createTextToolResult(text: string, isError = false): ToolResult {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
    isError,
  };
}

/**
 * Create a resource for testing
 */
export function createResource(
  uri: string,
  name: string,
  description?: string,
  mimeType?: string,
): Resource {
  return {
    uri,
    name,
    description,
    mimeType,
  };
}

/**
 * Create resource contents for testing
 */
export function createResourceContents(uri: string, text: string): ResourceContents {
  return {
    uri,
    contents: [
      {
        type: "resource",
        resource: {
          uri,
          text,
          mimeType: "text/plain",
        },
      },
    ],
  };
}

/**
 * Create a prompt for testing
 */
export function createPrompt(name: string, description?: string): Prompt {
  return {
    name,
    description,
  };
}

/**
 * Create a prompt result for testing
 */
export function createPromptResult(userMessage: string, assistantMessage: string): PromptResult {
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: userMessage,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: assistantMessage,
        },
      },
    ],
  };
}
