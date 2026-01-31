export interface TimedSentence {
  index: number
  startTime: number // seconds
  endTime: number
  text: string
}

export interface SelectedSentence extends TimedSentence {
  translation: string
  reason: string
}

export interface PipelineOptions {
  inputType: 'url' | 'file'
  input: string // URL or file path
  signal?: AbortSignal
}

export interface PipelineProgress {
  phase: string
  message: string
  percent: number
}

export interface PipelineResult {
  apkgPath: string
  cardCount: number
}

export interface Settings {
  aiProvider: 'openai' | 'ollama'
  openaiApiKey: string
  openaiModel: string
  ollamaModel: string
  ollamaUrl: string
  whisperMode: 'local' | 'cloud'
  whisperModelSize: string
  audioPaddingMs: number
  targetLanguage: string
  nativeLanguage: string
  uiLanguage: 'ko' | 'en'
  debugMode: boolean
  maxCards: number
}

export type SettingKey = keyof Settings

export interface ElectronAPI {
  settings: {
    get: <K extends SettingKey>(key: K) => Promise<Settings[K]>
    getAll: () => Promise<Settings>
    set: <K extends SettingKey>(key: K, value: Settings[K]) => Promise<void>
  }
  pipeline: {
    start: (options: PipelineOptions) => Promise<void>
    cancel: () => Promise<void>
    onProgress: (callback: (progress: PipelineProgress) => void) => () => void
    onComplete: (callback: (result: PipelineResult) => void) => () => void
    onError: (callback: (error: string) => void) => () => void
  }
  dialog: {
    openFile: (filters?: Electron.FileFilter[]) => Promise<string | null>
    saveFile: (defaultName: string) => Promise<string | null>
  }
  file: {
    copy: (src: string, dest: string) => Promise<void>
  }
  openai: {
    validateKey: (apiKey: string) => Promise<boolean>
    listModels: () => Promise<string[]>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
