import { dirname, join, normalize, resolve } from "@std/path";

/**
 * Cross-platform utility functions
 */
export class Platform {
  /**
   * Get the configuration directory based on platform
   * - Windows: %USERPROFILE%\.mcp-cli
   * - Linux (XDG): $XDG_CONFIG_HOME/mcp-cli
   * - macOS/Linux: ~/.mcp-cli
   */
  static getConfigDir(): string {
    const home = Deno.env.get("HOME") ||
      Deno.env.get("USERPROFILE") ||
      "";

    if (!home) {
      throw new Error("Could not determine home directory");
    }

    if (Deno.build.os === "windows") {
      return normalize(join(home, ".mcp-cli"));
    }

    // Respect XDG on Linux
    const xdgConfig = Deno.env.get("XDG_CONFIG_HOME");
    if (xdgConfig && Deno.build.os === "linux") {
      return normalize(join(xdgConfig, "mcp-cli"));
    }

    return normalize(join(home, ".mcp-cli"));
  }

  /**
   * Get the configuration file path
   */
  static getConfigPath(): string {
    return join(this.getConfigDir(), "config.json");
  }

  /**
   * Expand ~ to home directory in paths
   */
  static expandHome(path: string): string {
    if (!path.startsWith("~")) {
      return path;
    }

    const home = Deno.env.get("HOME") ||
      Deno.env.get("USERPROFILE") ||
      "";

    if (!home) {
      return path;
    }

    return join(home, path.slice(1));
  }

  /**
   * Normalize path for current platform
   */
  static normalizePath(path: string): string {
    return normalize(this.expandHome(path));
  }

  /**
   * Check if running on Windows
   */
  static isWindows(): boolean {
    return Deno.build.os === "windows";
  }

  /**
   * Check if running on macOS
   */
  static isMacOS(): boolean {
    return Deno.build.os === "darwin";
  }

  /**
   * Check if running on Linux
   */
  static isLinux(): boolean {
    return Deno.build.os === "linux";
  }

  /**
   * Get platform name
   */
  static getPlatform(): string {
    return Deno.build.os;
  }

  /**
   * Get architecture
   */
  static getArch(): string {
    return Deno.build.arch;
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  static async ensureDir(path: string): Promise<void> {
    try {
      await Deno.mkdir(path, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }
  }

  /**
   * Check if file exists
   */
  static async fileExists(path: string): Promise<boolean> {
    try {
      const stat = await Deno.stat(path);
      return stat.isFile;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Check if directory exists
   */
  static async dirExists(path: string): Promise<boolean> {
    try {
      const stat = await Deno.stat(path);
      return stat.isDirectory;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get current working directory
   */
  static getCurrentDir(): string {
    return Deno.cwd();
  }

  /**
   * Find config file by walking up directory tree
   * Searches for .mcp-cli.json starting from current directory
   * @param startDir - Directory to start search from (defaults to cwd)
   * @param filename - Config filename to search for (defaults to .mcp-cli.json)
   * @returns Path to config file if found, null otherwise
   */
  static async findConfigFile(
    startDir?: string,
    filename = ".mcp-cli.json",
  ): Promise<string | null> {
    // Resolve to absolute path first
    let currentDir = resolve(startDir || this.getCurrentDir());
    const root = Deno.build.os === "windows" ? currentDir.split("\\")[0] + "\\" : "/";

    // Safety check to prevent infinite loops
    let depth = 0;
    const maxDepth = 100;

    while (depth < maxDepth) {
      const configPath = join(currentDir, filename);
      if (await this.fileExists(configPath)) {
        return configPath;
      }

      // Check if we've reached root
      if (currentDir === root) {
        break;
      }

      // Move up one directory
      const parentDir = dirname(currentDir);

      // Break if we can't go up anymore
      if (parentDir === currentDir) {
        break;
      }

      currentDir = parentDir;
      depth++;
    }

    return null;
  }

  /**
   * Resolve config file path with priority:
   * 1. Explicit path (if provided)
   * 2. MCP_CONFIG environment variable
   * 3. Local .mcp-cli.json (current directory)
   * 4. Parent directory search for .mcp-cli.json
   * 5. Global config (~/.mcp-cli/config.json)
   *
   * @param explicitPath - Path explicitly provided by user (e.g., via --config flag)
   * @returns Resolved config path
   */
  static async resolveConfigPath(explicitPath?: string): Promise<string> {
    // 1. Explicit path takes highest priority
    if (explicitPath) {
      return this.normalizePath(explicitPath);
    }

    // 2. Check MCP_CONFIG environment variable
    const envConfigPath = Deno.env.get("MCP_CONFIG");
    if (envConfigPath) {
      return this.normalizePath(envConfigPath);
    }

    // 3. Check for local config in current directory
    const localConfig = join(this.getCurrentDir(), ".mcp-cli.json");
    if (await this.fileExists(localConfig)) {
      return localConfig;
    }

    // 4. Walk up directory tree to find config
    const foundConfig = await this.findConfigFile();
    if (foundConfig) {
      return foundConfig;
    }

    // 5. Fall back to global config
    return this.getConfigPath();
  }
}
