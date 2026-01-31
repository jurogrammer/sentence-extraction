import { getDb } from './connection'
import { DEFAULT_SETTINGS } from '../../shared/constants'
import type { Settings, SettingKey } from '../../shared/types'

let repo: SettingsRepo | null = null

class SettingsRepo {
  get<K extends SettingKey>(key: K): Settings[K] {
    const db = getDb()
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    if (!row) return DEFAULT_SETTINGS[key]
    return JSON.parse(row.value)
  }

  getAll(): Settings {
    const db = getDb()
    const rows = db.prepare('SELECT key, value FROM settings').all() as {
      key: string
      value: string
    }[]
    const result = { ...DEFAULT_SETTINGS } as Settings
    for (const row of rows) {
      if (row.key in DEFAULT_SETTINGS) {
        ;(result as Record<string, unknown>)[row.key] = JSON.parse(row.value)
      }
    }
    return result
  }

  set<K extends SettingKey>(key: K, value: Settings[K]): void {
    const db = getDb()
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      key,
      JSON.stringify(value)
    )
  }
}

export function getSettingsRepo(): SettingsRepo {
  if (!repo) repo = new SettingsRepo()
  return repo
}
