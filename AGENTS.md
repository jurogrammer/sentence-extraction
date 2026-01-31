# AGENTS.md - Agentic Coding Guide

This file provides comprehensive guidance for AI coding agents working in this repository.

## Project Overview

Electron desktop app generating Anki flashcard decks (.apkg) from videos. Downloads videos (YouTube via yt-dlp or local files), extracts/transcribes sentences, uses AI to select key learning sentences with translations, extracts audio clips and screenshots, and packages everything into an importable Anki deck.

## Build, Test & Run Commands

```bash
# Development
npm run dev          # Development with hot reload (electron-vite)

# Production
npm run build        # Build for production (outputs to /out)
npm run preview      # Preview production build
npm run package      # Package as distributable (.dmg on macOS)

# Post-install
npm run postinstall  # Rebuild native modules (better-sqlite3)
```

**No test runner or linter is currently configured.**

**Single test execution**: Not applicable (no test framework)

## Architecture

**Electron 3-process model**:
- **Main process** (`src/main/`) - Node.js backend with IPC handlers, SQLite database, service layer
- **Preload** (`src/preload/`) - Secure contextBridge API exposure
- **Renderer** (`src/renderer/`) - React 18 + TypeScript + Tailwind CSS frontend

**Tech Stack**: React 18, TypeScript (strict mode), Tailwind CSS 3, React Router 7, i18next, better-sqlite3, electron-vite, electron-builder

**Build System**: electron-vite with separate configs for main/preload/renderer processes

## Code Style Guidelines

### Import Organization

Organize imports in 3 tiers - external libraries, internal modules, then types:

```typescript
// External libraries first
import OpenAI from 'openai'
import { ipcMain, dialog } from 'electron'

// Node.js built-ins
import { copyFileSync } from 'fs'
import { join } from 'path'

// Type-only imports from shared
import type { PipelineOptions, SelectedSentence } from '../../shared/types'

// Internal modules (services, utils, db)
import { getSettingsRepo } from '../db/settings-repo'
import { logger } from '../utils/logger'
import { downloadVideo } from './video-download'
```

**Rules**:
- Use `type` keyword for type-only imports
- Relative paths with `../` (no path aliases configured)
- Alphabetical ordering within each tier

### Naming Conventions

- **Functions**: camelCase, verb-noun pattern (`downloadVideo`, `getSettingsRepo`, `createTempDir`)
- **Variables**: camelCase, descriptive (`currentAbort`, `tempDir`, `videoPath`, `maxCards`)
- **Classes**: PascalCase (`OpenAiProvider`, `SettingsRepo`)
- **Interfaces**: PascalCase (`AiProvider`, `TimedSentence`, `PipelineOptions`)
- **Type Aliases**: PascalCase (`type Status = 'idle' | 'running' | 'complete' | 'error'`)
- **Constants**: Object keys camelCase, module-level UPPER_SNAKE_CASE if appropriate

```typescript
// IPC constants
export const IPC = {
  SETTINGS_GET: 'settings:get',
  PIPELINE_START: 'pipeline:start'
}

// Default settings
export const DEFAULT_SETTINGS = {
  aiProvider: 'openai' as const,
  openaiApiKey: ''
}
```

### TypeScript Patterns

**Generic functions with constraints**:
```typescript
get<K extends SettingKey>(key: K): Settings[K] {
  // Type-safe value based on key
}

set<K extends SettingKey>(key: K, value: Settings[K]): void {
  // Ensures value matches key type
}
```

**Interface composition**:
```typescript
export interface SelectedSentence extends TimedSentence {
  translation: string
  reason: string
}
```

**Const assertions for literal types**:
```typescript
export const DEFAULT_SETTINGS = {
  aiProvider: 'openai' as const,
  whisperMode: 'cloud' as const
}
```

**Type-only imports**: Always use `import type` for types to enable proper tree-shaking

### Error Handling

**Always**:
- Log errors with context using `logger.error()`
- Use descriptive error messages
- Check error types with `instanceof Error`
- Clean up resources in `finally` blocks
- Truncate long error messages (`.slice(0, 200)`)

```typescript
try {
  // ... operation
  if (signal.aborted) throw new Error('Cancelled')
} catch (err) {
  logger.error('Operation failed', err)
  throw err
} finally {
  // Cleanup resources
  currentAbort = null
  if (!debugMode) {
    setTimeout(() => cleanupTempDir(tempDir), 5000)
  }
}
```

**IPC error handling**:
```typescript
try {
  const result = await runPipeline(options, onProgress)
  win.webContents.send(IPC.PIPELINE_COMPLETE, result)
} catch (err) {
  win.webContents.send(IPC.PIPELINE_ERROR, 
    err instanceof Error ? err.message : String(err))
}
```

### File Organization

**Backend** (`src/main/`):
```
src/main/
├── index.ts                    # Entry point
├── ipc-handlers.ts            # Centralized IPC registration
├── services/                  # Business logic
│   ├── pipeline.ts            # Orchestrator (5 sequential phases)
│   ├── ai-factory.ts          # Factory pattern for AI providers
│   ├── ai-provider.ts         # Interface definition
│   ├── ai-openai.ts           # OpenAI implementation
│   ├── ai-ollama.ts           # Ollama implementation
│   ├── whisper-factory.ts     # Factory for transcription
│   ├── whisper-local.ts       # Local whisper.cpp
│   ├── whisper-cloud.ts       # OpenAI Whisper API
│   ├── subtitle-extract.ts    # Subtitle parsing
│   ├── media-extract.ts       # Audio/screenshot extraction
│   ├── video-download.ts      # yt-dlp wrapper
│   └── anki-packager.ts       # .apkg builder
├── utils/                     # Utilities
│   ├── retry.ts               # Retry with exponential backoff
│   ├── logger.ts              # Structured logging
│   ├── temp-files.ts          # Temp directory management
│   └── bin-paths.ts           # External binary paths
└── db/                        # Data access
    ├── connection.ts          # Lazy-initialized DB singleton
    ├── settings-repo.ts       # Repository pattern
    └── schema.ts              # Schema initialization
```

**Frontend** (`src/renderer/`):
```
src/renderer/
├── main.tsx                   # Entry point
├── App.tsx                    # Root with routing
├── pages/                     # Page components
│   ├── MainPage.tsx
│   └── SettingsPage.tsx
├── components/                # Reusable UI components
│   ├── ProviderSelector.tsx
│   ├── FileUpload.tsx
│   ├── UrlInput.tsx
│   ├── ProgressLog.tsx
│   └── LanguageSwitch.tsx
├── hooks/                     # Custom React hooks
│   ├── usePipeline.ts        # Pipeline state + IPC listeners
│   └── useSettings.ts        # Settings CRUD + local sync
└── i18n/                      # i18next translations
    └── index.ts
```

**Shared** (`src/shared/`):
```
src/shared/
├── constants.ts               # IPC channels, default settings
└── types.ts                   # All TypeScript interfaces/types
```

### Service Layer Patterns

**Factory pattern** for pluggable implementations:
```typescript
// ai-factory.ts
export function getAiProvider(): AiProvider {
  const provider = getSettingsRepo().get('aiProvider')
  switch (provider) {
    case 'openai': return new OpenAiProvider()
    case 'ollama': return new OllamaProvider()
  }
}
```

**Interface-based abstraction**:
```typescript
// ai-provider.ts
export interface AiProvider {
  selectSentences(
    sentences: TimedSentence[],
    targetLang: string,
    nativeLang: string,
    maxCards: number
  ): Promise<SelectedSentence[]>
}
```

**Singleton repositories**:
```typescript
let repo: SettingsRepo | null = null

export function getSettingsRepo(): SettingsRepo {
  if (!repo) repo = new SettingsRepo()
  return repo
}
```

**Orchestrator pattern** (pipeline.ts):
- Coordinates 5 sequential phases
- Progress callbacks after each phase
- AbortSignal for cancellation
- Cleanup in finally block

**Batch processing** with controlled concurrency:
```typescript
const concurrency = 4
for (let i = 0; i < sentences.length; i += concurrency) {
  const batch = sentences.slice(i, i + concurrency)
  const promises = batch.map((s) => extractSingle(...))
  const results = await Promise.all(promises)
}
```

### IPC Communication

**All IPC channels defined as constants** (`src/shared/constants.ts`):
```typescript
export const IPC = {
  SETTINGS_GET: 'settings:get',
  PIPELINE_START: 'pipeline:start',
  PIPELINE_PROGRESS: 'pipeline:progress'
} as const
```

**Naming convention**: `DOMAIN:action` (e.g., `settings:get`, `pipeline:start`)

**Handler registration** (`src/main/ipc-handlers.ts`):
```typescript
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_GET, (_event, key: SettingKey) => {
    return getSettingsRepo().get(key)
  })
}
```

**Preload bridge** (`src/preload/index.ts`):
```typescript
const api: ElectronAPI = {
  settings: {
    get: (key) => ipcRenderer.invoke(IPC.SETTINGS_GET, key)
  }
}
contextBridge.exposeInMainWorld('api', api)
```

**Renderer usage**:
```typescript
const value = await window.api.settings.get('aiProvider')
```

### React Patterns

**Custom hooks for IPC**:
```typescript
export function usePipeline() {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<PipelineProgress | null>(null)

  useEffect(() => {
    const cleanup1 = window.api.pipeline.onProgress((p) => setProgress(p))
    const cleanup2 = window.api.pipeline.onComplete((r) => setStatus('complete'))
    return () => {
      cleanup1()
      cleanup2()
    }
  }, [])

  const start = useCallback(async (options: PipelineOptions) => {
    setStatus('running')
    await window.api.pipeline.start(options)
  }, [])

  return { status, progress, start }
}
```

**Component hierarchy**: Page → Hooks → Components → Presentational

**Presentational components** receive props, no hooks:
```typescript
interface Props {
  progress: PipelineProgress | null
}
export default function ProgressLog({ progress }: Props) {
  if (!progress) return null
  return <div>...</div>
}
```

**Page components** use hooks, manage local state:
```typescript
export default function MainPage() {
  const { status, progress, start } = usePipeline()
  const [url, setUrl] = useState('')
  // ...
}
```

## Common Patterns

### Database Access

**Singleton connection** with lazy initialization:
```typescript
let db: Database.Database | null = null
export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    initSchema(db)
  }
  return db
}
```

**Repository pattern** with typed generics:
```typescript
class SettingsRepo {
  get<K extends SettingKey>(key: K): Settings[K] {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key)
    return row ? JSON.parse(row.value) : DEFAULT_SETTINGS[key]
  }
}
```

### External Binary Management

**Path resolution** (`src/main/utils/bin-paths.ts`):
```typescript
function which(bin: string): string | null {
  try {
    return execFileSync('which', [bin], { encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

export function getFfmpegPath(): string {
  const p = which('ffmpeg')
  if (!p) throw new Error('ffmpeg not found. Install ffmpeg and add to PATH.')
  return p
}
```

### Retry Logic

**Exponential backoff**:
```typescript
export async function retry<T>(
  fn: () => Promise<T>,
  { attempts = 3, delayMs = 1000, label = 'operation' } = {}
): Promise<T> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === attempts) throw err
      logger.warn(`${label} failed (attempt ${i}/${attempts}), retrying...`)
      await new Promise((r) => setTimeout(r, delayMs * i))
    }
  }
  throw new Error('unreachable')
}
```

## Important Notes

- **Strict TypeScript**: All code uses `"strict": true` - no implicit any
- **No type suppression**: Never use `as any`, `@ts-ignore`, or `@ts-expect-error`
- **No Zustand**: State managed via React hooks + IPC, not Zustand stores
- **Tailwind CSS**: Use utility classes for styling
- **i18n**: All user-facing strings must use `t()` from `react-i18next`
- **External dependencies**: yt-dlp, ffmpeg, ffprobe, whisper.cpp must be in PATH
- **SQLite**: Settings stored in SQLite with JSON serialization
- **AbortSignal**: All long-running operations support cancellation via AbortSignal

## Adding New Features

**New AI provider**:
1. Create `src/main/services/ai-newprovider.ts` implementing `AiProvider`
2. Add to factory switch in `src/main/services/ai-factory.ts`
3. Add settings to `DEFAULT_SETTINGS` in `src/shared/constants.ts`
4. Update `Settings` interface in `src/shared/types.ts`

**New IPC channel**:
1. Add constant to `IPC` in `src/shared/constants.ts`
2. Register handler in `src/main/ipc-handlers.ts`
3. Add to preload bridge in `src/preload/index.ts`
4. Add to `ElectronAPI` interface in `src/shared/types.ts`
5. Use in renderer via `window.api.*`

**New service**:
1. Create in `src/main/services/`
2. Export pure functions or singleton class
3. Inject dependencies via getters (`getSettingsRepo()`, `getDb()`)
4. Support AbortSignal for cancellation
5. Log operations with `logger`
