export const IPC = {
  SETTINGS_GET: 'settings:get',
  SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_SET: 'settings:set',
  PIPELINE_START: 'pipeline:start',
  PIPELINE_CANCEL: 'pipeline:cancel',
  PIPELINE_PROGRESS: 'pipeline:progress',
  PIPELINE_COMPLETE: 'pipeline:complete',
  PIPELINE_ERROR: 'pipeline:error',
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_OPEN_SUBTITLE: 'dialog:open-subtitle',
  DIALOG_SAVE_FILE: 'dialog:save-file',
  FILE_COPY: 'file:copy',
  OPENAI_VALIDATE_KEY: 'openai:validate-key',
  OPENAI_LIST_MODELS: 'openai:list-models'
} as const

export const DEFAULT_SETTINGS = {
  aiProvider: 'openai' as const,
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  ollamaModel: 'llama3.2',
  ollamaUrl: 'http://localhost:11434',
  whisperMode: 'cloud' as const,
  whisperModelSize: 'base',
  audioPaddingMs: 500,
  targetLanguage: 'en',
  nativeLanguage: 'ko',
  uiLanguage: 'ko' as const,
  debugMode: false,
  maxCards: 30
}
