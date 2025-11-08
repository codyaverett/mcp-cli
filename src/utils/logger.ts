/**
 * Logging utility - logs to stderr to avoid polluting stdout
 */

import chalk from 'chalk';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel | string): void {
    if (typeof level === 'string') {
      const levelMap: Record<string, LogLevel> = {
        error: LogLevel.ERROR,
        warn: LogLevel.WARN,
        info: LogLevel.INFO,
        debug: LogLevel.DEBUG,
        trace: LogLevel.TRACE,
      };
      this.level = levelMap[level] ?? LogLevel.INFO;
    } else {
      this.level = level;
    }
  }

  error(message: string, data?: unknown): void {
    if (this.level >= LogLevel.ERROR) {
      this.log('ERROR', chalk.red(message), data);
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.level >= LogLevel.WARN) {
      this.log('WARN', chalk.yellow(message), data);
    }
  }

  info(message: string, data?: unknown): void {
    if (this.level >= LogLevel.INFO) {
      this.log('INFO', chalk.blue(message), data);
    }
  }

  debug(message: string, data?: unknown): void {
    if (this.level >= LogLevel.DEBUG) {
      this.log('DEBUG', chalk.gray(message), data);
    }
  }

  trace(message: string, data?: unknown): void {
    if (this.level >= LogLevel.TRACE) {
      this.log('TRACE', chalk.gray(message), data);
    }
  }

  private log(level: string, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const prefix = chalk.gray(`[${timestamp}] [${level}]`);

    if (data) {
      console.error(`${prefix} ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.error(`${prefix} ${message}`);
    }
  }
}

export const logger = new Logger();
