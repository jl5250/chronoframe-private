import fs from 'fs'
import path from 'path'
import type { ConsolaReporter, LogObject } from 'consola'
import { createConsola } from 'consola'

const logDir = path.join(process.cwd(), 'data', 'logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const logFilePath = path.join(logDir, 'app.log')

const serializeError = (error: Error): Record<string, unknown> => {
  const data: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  }

  if (error.cause !== undefined) {
    data.cause = error.cause
  }

  for (const key of Object.getOwnPropertyNames(error)) {
    if (key === 'name' || key === 'message' || key === 'stack' || key === 'cause') {
      continue
    }
    if (key === 'cert') {
      continue
    }

    const value: unknown = Reflect.get(error, key)
    data[key] = value
  }

  return data
}

const safeJsonStringify = (value: unknown): string => {
  const seen = new WeakSet<object>()

  return JSON.stringify(value, (_key, current: unknown) => {
    if (typeof current === 'bigint') {
      return current.toString()
    }

    if (typeof current === 'function') {
      return `[Function${current.name ? `: ${current.name}` : ''}]`
    }

    if (typeof current === 'symbol') {
      return current.toString()
    }

    if (current instanceof Error) {
      return serializeError(current)
    }

    if (current instanceof Map) {
      return { type: 'Map', entries: Array.from(current.entries()) }
    }

    if (current instanceof Set) {
      return { type: 'Set', values: Array.from(current.values()) }
    }

    if (typeof current === 'object' && current !== null) {
      if (seen.has(current)) {
        return '[Circular]'
      }
      seen.add(current)
    }

    return current
  })
}

const createLogLine = (logObj: LogObject): string => {
  try {
    return `${safeJsonStringify(logObj)}\n`
  } catch (error) {
    try {
      return `${safeJsonStringify({
        date: logObj.date,
        level: logObj.level,
        type: logObj.type,
        tag: logObj.tag,
        message: logObj.message,
        additional: logObj.additional,
        args: logObj.args?.map((arg) => (arg instanceof Error ? serializeError(arg) : arg)),
        stringifyError: error instanceof Error ? serializeError(error) : String(error),
      })}\n`
    } catch {
      return `${new Date().toISOString()} [logger] Unserializable log\n`
    }
  }
}

const logFileReporter: ConsolaReporter = {
  log: (logObj: LogObject) => {
    const logLine = createLogLine(logObj)
    fs.appendFile(logFilePath, logLine, (err) => {
      if (err) {
        console.error('Failed to write log to file:', err)
      }
    })
  },
}

const mConsola = createConsola({
  formatOptions: {
    date: true,
    colors: true,
    compact: false,
  },
})

mConsola.addReporter(logFileReporter)

export const logger = {
  chrono: mConsola.withTag('cframe/main'),
  storage: mConsola.withTag('cframe/storage'),
  fs: mConsola.withTag('cframe/fs'),
  image: mConsola.withTag('cframe/image'),
  location: mConsola.withTag('cframe/location'),
  dynamic: (id: string) => mConsola.withTag(`cframe/${id}`),
}

export type Logger = Omit<typeof logger, 'dynamic'>
export type DynamicLogger = typeof logger.dynamic
