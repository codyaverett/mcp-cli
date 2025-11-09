/**
 * MCP Tool definition
 */
export interface Tool {
  name: string;
  description?: string;
  inputSchema: ToolInputSchema;
}

/**
 * Tool input schema (JSON Schema)
 */
export interface ToolInputSchema {
  type: "object";
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * JSON Schema property definition
 */
export interface JSONSchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  [key: string]: unknown;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

/**
 * Tool content (can be text, image, resource, etc.)
 */
export type ToolContent = TextContent | ImageContent | ResourceContent;

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export interface ResourceContent {
  type: "resource";
  resource: {
    uri: string;
    text?: string;
    blob?: string;
    mimeType?: string;
  };
}

/**
 * MCP Resource definition
 */
export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Resource contents
 */
export interface ResourceContents {
  uri: string;
  contents: ResourceContent[];
}

/**
 * MCP Prompt definition
 */
export interface Prompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

/**
 * Prompt argument
 */
export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * Prompt message
 */
export interface PromptMessage {
  role: "user" | "assistant";
  content: TextContent | ImageContent;
}

/**
 * Prompt result
 */
export interface PromptResult {
  description?: string;
  messages: PromptMessage[];
}

/**
 * Brief tool description (for --brief mode)
 */
export interface BriefTool {
  name: string;
  description?: string;
}

/**
 * Server info response
 */
export interface ServerInfo {
  name: string;
  version: string;
  protocolVersion?: string;
  capabilities?: {
    tools?: {
      listChanged?: boolean;
    };
    resources?: {
      subscribe?: boolean;
      listChanged?: boolean;
    };
    prompts?: {
      listChanged?: boolean;
    };
  };
  serverInfo?: {
    name?: string;
    version?: string;
  };
}

/**
 * Server inspection summary
 */
export interface ServerInspection {
  tools: number;
  resources: number;
  prompts: number;
  capabilities: string[];
  categories?: string[];
}
