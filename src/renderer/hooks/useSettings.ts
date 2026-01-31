import { useEffect, useState, useCallback } from 'react'
import type { Settings, SettingKey } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/constants'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.settings.getAll().then((s) => {
      setSettings(s)
      setLoading(false)
    })
  }, [])

  const update = useCallback(async <K extends SettingKey>(key: K, value: Settings[K]) => {
    await window.api.settings.set(key, value)
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  return { settings, loading, update }
}
