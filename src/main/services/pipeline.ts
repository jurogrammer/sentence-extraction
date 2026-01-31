import { copyFileSync } from 'fs'
import { join } from 'path'
import type { PipelineOptions, PipelineProgress, PipelineResult, TimedSentence } from '../../shared/types'
import { createTempDir, ensureDir, cleanupTempDir } from '../utils/temp-files'
import { logger } from '../utils/logger'
import { getSettingsRepo } from '../db/settings-repo'
import { downloadVideo } from './video-download'
import { parseSubtitleFile } from './subtitle-extract'
import { transcribe } from './whisper-factory'
import { getAiProvider } from './ai-factory'
import { extractMediaForSentences } from './media-extract'
import { buildApkg } from './anki-packager'
import { retry } from '../utils/retry'

let currentAbort: AbortController | null = null

export function cancelPipeline(): void {
  currentAbort?.abort()
}

export async function runPipeline(
  options: PipelineOptions,
  onProgress: (progress: PipelineProgress) => void
): Promise<PipelineResult> {
  const abort = new AbortController()
  currentAbort = abort
  const signal = abort.signal
  const settings = getSettingsRepo()
  const debugMode = settings.get('debugMode')
  const tempDir = createTempDir()
  const mediaDir = join(tempDir, 'media')
  ensureDir(mediaDir)

  logger.info(`Pipeline started. Temp dir: ${tempDir}`)

  try {
    // Phase 1: Get video
    onProgress({ phase: 'download', message: 'Downloading video...', percent: 0 })
    let videoPath: string
    let subtitlePath: string | null = null

    if (options.inputType === 'url') {
      const result = await downloadVideo(options.input, tempDir, (p) => {
        onProgress({ phase: 'download', message: `Downloading: ${p.toFixed(0)}%`, percent: p * 0.3 / 100 })
      }, signal)
      videoPath = result.videoPath
      subtitlePath = result.subtitlePath
    } else {
      // Local file — copy to temp
      const ext = options.input.split('.').pop() || 'mp4'
      videoPath = join(tempDir, `input.${ext}`)
      copyFileSync(options.input, videoPath)
    }

    if (signal.aborted) throw new Error('Cancelled')

     // Phase 2: Get sentences
     onProgress({ phase: 'subtitles', message: 'Extracting sentences...', percent: 30 })
     let sentences: TimedSentence[]

     // Subtitle priority: user-provided > yt-dlp embedded > Whisper transcription
     if (options.subtitlePath) {
       logger.info('Using user-provided subtitle file...')
       const userSubtitlePath = join(tempDir, `user-subtitle.${options.subtitlePath.split('.').pop()}`)
       copyFileSync(options.subtitlePath, userSubtitlePath)
       sentences = parseSubtitleFile(userSubtitlePath)
     } else if (subtitlePath) {
       logger.info('Parsing subtitle file from video...')
       sentences = parseSubtitleFile(subtitlePath)
     } else {
       logger.info('No subtitles found, using Whisper transcription...')
       onProgress({ phase: 'whisper', message: 'Transcribing audio...', percent: 35 })
       sentences = await transcribe(videoPath, tempDir, signal)
     }

    if (sentences.length === 0) throw new Error('No sentences found in video')
    logger.info(`Found ${sentences.length} sentences`)

    if (signal.aborted) throw new Error('Cancelled')

    // Phase 3: AI selection
    onProgress({ phase: 'ai', message: 'Selecting key sentences...', percent: 50 })
    const provider = getAiProvider()
    const targetLang = settings.get('targetLanguage')
    const nativeLang = settings.get('nativeLanguage')
    const maxCards = settings.get('maxCards')

    const selected = await retry(
      () => provider.selectSentences(sentences, targetLang, nativeLang, maxCards),
      { attempts: 3, label: 'AI sentence selection' }
    )

    if (selected.length === 0) throw new Error('AI returned no selections')
    logger.info(`Selected ${selected.length} sentences`)

    if (signal.aborted) throw new Error('Cancelled')

    // Phase 4: Extract media
    onProgress({ phase: 'media', message: 'Extracting audio & screenshots...', percent: 65 })
    const mediaMap = await extractMediaForSentences(videoPath, selected, mediaDir, signal)

    if (signal.aborted) throw new Error('Cancelled')

    // Phase 5: Build .apkg
    onProgress({ phase: 'package', message: 'Building Anki package...', percent: 85 })
    const sourceUrl = options.inputType === 'url' ? options.input : options.input
    const apkgPath = await buildApkg(selected, mediaMap, tempDir, sourceUrl)

    onProgress({ phase: 'done', message: 'Complete!', percent: 100 })

    return { apkgPath, cardCount: selected.length }
  } catch (err) {
    logger.error('Pipeline failed', err)
    throw err
  } finally {
    currentAbort = null
    if (!debugMode) {
      // Delay cleanup to allow file save
      setTimeout(() => cleanupTempDir(tempDir), 5000)
    }
  }
}
