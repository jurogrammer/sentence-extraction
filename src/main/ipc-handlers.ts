import { ipcMain, dialog, BrowserWindow } from 'electron'
import OpenAI from 'openai'
import { IPC } from '../shared/constants'
import { getSettingsRepo } from './db/settings-repo'
import { logger } from './utils/logger'
import type { PipelineOptions, SettingKey, Settings } from '../shared/types'

export function registerIpcHandlers(): void {
  const settings = getSettingsRepo()

  ipcMain.handle(IPC.SETTINGS_GET, (_event, key: SettingKey) => {
    return settings.get(key)
  })

  ipcMain.handle(IPC.SETTINGS_GET_ALL, () => {
    return settings.getAll()
  })

  ipcMain.handle(IPC.SETTINGS_SET, (_event, key: SettingKey, value: unknown) => {
    settings.set(key, value as Settings[SettingKey])
  })

  ipcMain.handle(IPC.DIALOG_OPEN_FILE, async (_event, filters?: Electron.FileFilter[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [
        { name: 'Video Files', extensions: ['mp4', 'mkv', 'webm', 'avi', 'mov'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.DIALOG_SAVE_FILE, async (_event, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'Anki Package', extensions: ['apkg'] }]
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle(IPC.PIPELINE_START, async (event, options: PipelineOptions) => {
    const { runPipeline } = await import('./services/pipeline')
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    try {
      const result = await runPipeline(options, (progress) => {
        win.webContents.send(IPC.PIPELINE_PROGRESS, progress)
      })
      win.webContents.send(IPC.PIPELINE_COMPLETE, result)
    } catch (err) {
      win.webContents.send(IPC.PIPELINE_ERROR, err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC.FILE_COPY, async (_event, src: string, dest: string) => {
    const { copyFileSync } = await import('fs')
    copyFileSync(src, dest)
  })

  ipcMain.handle(IPC.PIPELINE_CANCEL, async () => {
    const { cancelPipeline } = await import('./services/pipeline')
    cancelPipeline()
  })

  ipcMain.handle(IPC.OPENAI_VALIDATE_KEY, async (_event, apiKey: string) => {
    try {
      const client = new OpenAI({ apiKey })
      await client.models.list()
      return true
    } catch (err) {
      logger.error('OpenAI key validation failed', err)
      return false
    }
  })

  ipcMain.handle(IPC.OPENAI_LIST_MODELS, async () => {
    try {
      const apiKey = settings.get('openaiApiKey')
      if (!apiKey) throw new Error('OpenAI API key not configured')

      const client = new OpenAI({ apiKey })
      const models = await client.models.list()
      
      // Filter for GPT models only
      const gptModels = models.data
        .filter((model) => model.id.includes('gpt'))
        .map((model) => model.id)
      
      return gptModels
    } catch (err) {
      logger.error('Failed to list OpenAI models', err)
      throw err instanceof Error ? err : new Error(String(err))
    }
  })
}
