import { logger } from './logger'

export async function retry<T>(
  fn: () => Promise<T>,
  { attempts = 3, delayMs = 1000, label = 'operation' } = {}
): Promise<T> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === attempts) throw err
      logger.warn(`${label} failed (attempt ${i}/${attempts}), retrying...`, err)
      await new Promise((r) => setTimeout(r, delayMs * i))
    }
  }
  throw new Error('unreachable')
}
