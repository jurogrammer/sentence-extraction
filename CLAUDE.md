# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Electron desktop app that generates Anki flashcard decks (.apkg) from videos. It downloads videos (YouTube via yt-dlp or local files), extracts/transcribes sentences, uses AI to select key learning sentences with translations, extracts audio clips and screenshots, and packages everything into an importable Anki deck.

## Build & Run Commands

```bash
npm run dev          # Development with hot reload
npm run build        # Production build (outputs to /out)
npm run package      # Package as distributable (.dmg on macOS)
npm run postinstall  # Rebuild native modules (better-sqlite3)
```

No test runner or linter is currently configured.

## Architecture

**Electron 3-process model** with electron-vite build system:

- **Main process** (`src/main/`) - Node.js backend with IPC handlers, SQLite database, and service layer
- **Preload** (`src/preload/`) - Secure contextBridge API exposure
- **Renderer** (`src/renderer/`) - React 18 + TypeScript + Tailwind CSS + Zustand frontend

### Pipeline (core workflow in `src/main/services/pipeline.ts`)

Five sequential phases orchestrated by the pipeline service:

1. **Download** (`video-download.ts`) - yt-dlp downloads video + subtitles
2. **Sentence Extraction** (`subtitle-extract.ts`) - Parse .srt/.vtt, or transcribe via Whisper (`whisper-factory.ts` → `whisper-local.ts` / `whisper-cloud.ts`)
3. **AI Selection** (`ai-factory.ts` → `ai-openai.ts` / `ai-ollama.ts`) - Pick key sentences, generate translations
4. **Media Extraction** (`media-extract.ts`) - ffmpeg extracts audio clips + screenshots per sentence
5. **Packaging** (`anki-packager.ts`) - Builds .apkg (SQLite + media zip) via better-sqlite3 + archiver

### Key Patterns

- **IPC communication**: All main↔renderer calls go through channels defined in `src/shared/constants.ts`, handled in `src/main/ipc-handlers.ts`
- **AI provider abstraction**: `ai-factory.ts` creates either OpenAI or Ollama provider implementing the interface in `ai-provider.ts`
- **Whisper abstraction**: `whisper-factory.ts` routes to local (whisper.cpp) or cloud (OpenAI API) transcription
- **External binaries**: Paths to yt-dlp, ffmpeg, whisper resolved in `src/main/utils/bin-paths.ts`
- **Settings**: Stored in SQLite via `src/main/db/settings-repo.ts`
- **i18n**: English and Korean translations in `src/renderer/i18n/`

### Tech Stack

React 18, TypeScript (strict), Tailwind CSS 3, Zustand, React Router 7, i18next, better-sqlite3, electron-vite, electron-builder
