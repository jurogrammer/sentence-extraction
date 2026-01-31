import type { TimedSentence } from '../../shared/types'
import { getSettingsRepo } from '../db/settings-repo'
import { transcribeCloud } from './whisper-cloud'
import { transcribeLocal } from './whisper-local'
import { getFfmpegPath } from '../utils/bin-paths'
import { spawn } from 'child_process'
import { join } from 'path'
import { logger } from '../utils/logger'

/** Extract audio from video for cloud transcription */
async function extractAudio(videoPath: string, tempDir: string, signal?: AbortSignal): Promise<string> {
  const outPath = join(tempDir, 'audio.mp3')
  const ffmpeg = getFfmpegPath()
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, [
      '-i', videoPath, '-vn', '-acodec', 'libmp3lame', '-q:a', '4', '-y', outPath
    ], { stdio: ['ignore', 'ignore', 'pipe'] })

    if (signal) {
      signal.addEventListener('abort', () => proc.kill('SIGTERM'))
    }

    let stderr = ''
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve(outPath)
      else reject(new Error(`Audio extraction failed: ${stderr.slice(0, 200)}`))
    })
    proc.on('error', reject)
  })
}

export async function transcribe(
  videoPath: string,
  tempDir: string,
  signal?: AbortSignal
): Promise<TimedSentence[]> {
  const mode = getSettingsRepo().get('whisperMode')
  logger.info(`Whisper mode: ${mode}`)

  if (mode === 'cloud') {
    const audioPath = await extractAudio(videoPath, tempDir, signal)
    return transcribeCloud(audioPath)
  }
  return transcribeLocal(videoPath, tempDir, signal)
}
