import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/constants'
import type { ElectronAPI } from '../shared/types'

const api: ElectronAPI = {
  settings: {
    get: (key) => ipcRenderer.invoke(IPC.SETTINGS_GET, key),
    getAll: () => ipcRenderer.invoke(IPC.SETTINGS_GET_ALL),
    set: (key, value) => ipcRenderer.invoke(IPC.SETTINGS_SET, key, value)
  },
  pipeline: {
    start: (options) => ipcRenderer.invoke(IPC.PIPELINE_START, options),
    cancel: () => ipcRenderer.invoke(IPC.PIPELINE_CANCEL),
    onProgress: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: unknown) =>
        callback(progress as Parameters<typeof callback>[0])
      ipcRenderer.on(IPC.PIPELINE_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC.PIPELINE_PROGRESS, handler)
    },
    onComplete: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, result: unknown) =>
        callback(result as Parameters<typeof callback>[0])
      ipcRenderer.on(IPC.PIPELINE_COMPLETE, handler)
      return () => ipcRenderer.removeListener(IPC.PIPELINE_COMPLETE, handler)
    },
    onError: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, error: unknown) =>
        callback(error as string)
      ipcRenderer.on(IPC.PIPELINE_ERROR, handler)
      return () => ipcRenderer.removeListener(IPC.PIPELINE_ERROR, handler)
    }
  },
  dialog: {
    openFile: (filters) => ipcRenderer.invoke(IPC.DIALOG_OPEN_FILE, filters),
    saveFile: (defaultName) => ipcRenderer.invoke(IPC.DIALOG_SAVE_FILE, defaultName)
  },
  file: {
    copy: (src, dest) => ipcRenderer.invoke(IPC.FILE_COPY, src, dest)
  }
}

contextBridge.exposeInMainWorld('api', api)
