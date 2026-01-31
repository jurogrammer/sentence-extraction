import { mkdtempSync, rmSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export function createTempDir(): string {
  const base = join(tmpdir(), 'anki-gen-')
  return mkdtempSync(base)
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function cleanupTempDir(dir: string): void {
  try {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true })
    }
  } catch {
    // best-effort cleanup
  }
}
