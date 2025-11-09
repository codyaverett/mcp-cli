import { join, normalize } from "@std/path";

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
}
