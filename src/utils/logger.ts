import { LogLevel } from "../types/config.ts";

/**
 * Logger utility that writes to stderr to avoid polluting stdout
 * (stdout is reserved for JSON output)
 */
export class Logger {
  private level: LogLevel;
  private static instance: Logger;

  private constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  /**
   * Get logger instance (singleton)
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Log error message
   */
  error(message: string, meta?: Record<string, unknown>): void {
    if (this.level >= LogLevel.ERROR) {
      this.write("ERROR", message, meta);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.level >= LogLevel.WARN) {
      this.write("WARN", message, meta);
    }
  }

  /**
   * Log info message
   */
  info(message: string, meta?: Record<string, unknown>): void {
    if (this.level >= LogLevel.INFO) {
      this.write("INFO", message, meta);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.level >= LogLevel.DEBUG) {
      this.write("DEBUG", message, meta);
    }
  }

  /**
   * Log trace message
   */
  trace(message: string, meta?: Record<string, unknown>): void {
    if (this.level >= LogLevel.TRACE) {
      this.write("TRACE", message, meta);
    }
  }

  /**
   * Write log message to stderr
   */
  private write(
    levelName: string,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${levelName}]`;

    let output = `${prefix} ${message}`;

    if (meta && Object.keys(meta).length > 0) {
      const metaStr = JSON.stringify(meta, null, 2)
        .split("\n")
        .map((line) => "  " + line)
        .join("\n");
      output += "\n" + metaStr;
    }

    // Write to stderr to keep stdout clean for JSON output
    console.error(output);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): ContextLogger {
    return new ContextLogger(this, context);
  }
}

/**
 * Logger with additional context
 */
class ContextLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, unknown>,
  ) {}

  error(message: string, meta?: Record<string, unknown>): void {
    this.parent.error(message, { ...this.context, ...meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.parent.warn(message, { ...this.context, ...meta });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.parent.info(message, { ...this.context, ...meta });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.parent.debug(message, { ...this.context, ...meta });
  }

  trace(message: string, meta?: Record<string, unknown>): void {
    this.parent.trace(message, { ...this.context, ...meta });
  }
}

/**
 * Default logger instance
 */
export const logger = Logger.getInstance();
