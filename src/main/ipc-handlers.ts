import { ipcMain, dialog, BrowserWindow } from 'electron'
import { IPC } from '../shared/constants'
import { getSettingsRepo } from './db/settings-repo'
import type { PipelineOptions, SettingKey } from '../shared/types'

export function registerIpcHandlers(): void {
  const settings = getSettingsRepo()

  ipcMain.handle(IPC.SETTINGS_GET, (_event, key: SettingKey) => {
    return settings.get(key)
  })

  ipcMain.handle(IPC.SETTINGS_GET_ALL, () => {
    return settings.getAll()
  })

  ipcMain.handle(IPC.SETTINGS_SET, (_event, key: SettingKey, value: unknown) => {
    settings.set(key, value)
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
}
