/**
 * Production-grade logger for TheHoneyBee Mobile App.
 * Provides structured, timestamped console output with level filtering.
 * All API headers, requests, and responses are logged for easy debugging.
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_COLORS: Record<LogLevel, string> = {
  DEBUG: '🔍',
  INFO: 'ℹ️',
  WARN: '⚠️',
  ERROR: '❌',
};

// Set to 'DEBUG' for development, 'WARN' for production
let currentLevel: LogLevel = __DEV__ ? 'DEBUG' : 'WARN';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function timestamp(): string {
  return new Date().toISOString().split('T')[1].replace('Z', '');
}

function formatTag(tag: string): string {
  return `[${tag}]`;
}

function log(level: LogLevel, tag: string, message: string, data?: any): void {
  if (!shouldLog(level)) return;

  const prefix = `${LOG_COLORS[level]} ${timestamp()} ${formatTag(tag)}`;
  const logFn = level === 'ERROR' ? console.error
    : level === 'WARN' ? console.warn
    : console.log;

  if (data !== undefined) {
    logFn(`${prefix} ${message}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    logFn(`${prefix} ${message}`);
  }
}

export const Logger = {
  debug: (tag: string, message: string, data?: any) => log('DEBUG', tag, message, data),
  info: (tag: string, message: string, data?: any) => log('INFO', tag, message, data),
  warn: (tag: string, message: string, data?: any) => log('WARN', tag, message, data),
  error: (tag: string, message: string, data?: any) => log('ERROR', tag, message, data),

  /** Log an API request with full headers, URL, method, and body */
  apiRequest: (method: string, url: string, headers?: Record<string, string>, body?: any) => {
    if (!shouldLog('DEBUG')) return;
    console.log(`\n🌐 ━━━━ API REQUEST ━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  ${method.toUpperCase()} ${url}`);
    if (headers) console.log(`  Headers:`, JSON.stringify(headers, null, 2));
    if (body) console.log(`  Body:`, typeof body === 'string' ? body.substring(0, 500) : JSON.stringify(body, null, 2));
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  },

  /** Log an API response with status, timing, headers, and body */
  apiResponse: (method: string, url: string, status: number, durationMs: number, body?: any) => {
    if (!shouldLog('DEBUG')) return;
    const statusEmoji = status >= 200 && status < 300 ? '✅' : status >= 400 ? '❌' : '⚡️';
    console.log(`\n${statusEmoji} ━━━━ API RESPONSE ━━━━━━━━━━━━━━━━━━━`);
    console.log(`  ${method.toUpperCase()} ${url}`);
    console.log(`  Status: ${status} | Duration: ${durationMs}ms`);
    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
      console.log(`  Body: ${bodyStr.substring(0, 1000)}`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  },

  /** Set the minimum log level */
  setLevel: (level: LogLevel) => {
    currentLevel = level;
  },
};
