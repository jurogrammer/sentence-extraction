import { spawn } from 'child_process'
import { getFfmpegPath } from '../utils/bin-paths'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFileSync } from 'fs'
import type { TimedSentence } from '../../shared/types'
import { getSettingsRepo } from '../db/settings-repo'
import { logger } from '../utils/logger'

function getWhisperCppPath(): string {
  // Check common install locations
  const candidates = [
    '/usr/local/bin/whisper-cpp',
    '/opt/homebrew/bin/whisper-cpp',
    '/usr/bin/whisper-cpp',
    join(process.env.HOME || '', '.local/bin/whisper-cpp')
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  throw new Error('whisper.cpp not found. Please install whisper-cpp and ensure it is in your PATH.')
}

/** Convert video to 16kHz WAV for whisper.cpp */
async function toWav(inputPath: string, tempDir: string, signal?: AbortSignal): Promise<string> {
  const outPath = join(tempDir, 'audio.wav')
  const ffmpeg = getFfmpegPath()
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, [
      '-i', inputPath,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      '-y',
      outPath
    ], { stdio: ['ignore', 'ignore', 'pipe'] })

    if (signal) {
      signal.addEventListener('abort', () => proc.kill('SIGTERM'))
    }

    let stderr = ''
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve(outPath)
      else reject(new Error(`ffmpeg wav conversion failed: ${stderr.slice(0, 200)}`))
    })
    proc.on('error', reject)
  })
}

export async function transcribeLocal(
  videoPath: string,
  tempDir: string,
  signal?: AbortSignal
): Promise<TimedSentence[]> {
  const settings = getSettingsRepo()
  const modelSize = settings.get('whisperModelSize')

  logger.info(`Transcribing locally with whisper.cpp (model: ${modelSize})...`)

  const wavPath = await toWav(videoPath, tempDir, signal)
  const whisper = getWhisperCppPath()
  const outputBase = join(tempDir, 'whisper-out')

  return new Promise((resolve, reject) => {
    const proc = spawn(whisper, [
      '-m', `models/ggml-${modelSize}.bin`,
      '-f', wavPath,
      '--output-srt',
      '--output-file', outputBase
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    if (signal) {
      signal.addEventListener('abort', () => proc.kill('SIGTERM'))
    }

    let stderr = ''
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`whisper.cpp failed: ${stderr.slice(0, 200)}`))
        return
      }
      try {
        const srtPath = outputBase + '.srt'
        if (!existsSync(srtPath)) {
          reject(new Error('whisper.cpp did not produce .srt output'))
          return
        }
        const { parseSubtitleFile } = await import('./subtitle-extract')
        resolve(parseSubtitleFile(srtPath))
      } catch (err) {
        reject(err)
      }
    })
    proc.on('error', reject)
  })
}
