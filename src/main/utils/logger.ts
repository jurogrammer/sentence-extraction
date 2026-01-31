type Level = 'debug' | 'info' | 'warn' | 'error'

function log(level: Level, msg: string, data?: unknown): void {
  const ts = new Date().toISOString()
  const line = `[${ts}] [${level.toUpperCase()}] ${msg}`
  if (data !== undefined) {
    console[level](line, data)
  } else {
    console[level](line)
  }
}

export const logger = {
  debug: (msg: string, data?: unknown) => log('debug', msg, data),
  info: (msg: string, data?: unknown) => log('info', msg, data),
  warn: (msg: string, data?: unknown) => log('warn', msg, data),
  error: (msg: string, data?: unknown) => log('error', msg, data)
}
