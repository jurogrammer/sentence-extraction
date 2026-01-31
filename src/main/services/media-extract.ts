import { spawn } from 'child_process'
import { join } from 'path'
import { getFfmpegPath } from '../utils/bin-paths'
import type { SelectedSentence } from '../../shared/types'
import { logger } from '../utils/logger'
import { getSettingsRepo } from '../db/settings-repo'

export interface MediaFiles {
  audioPath: string
  imagePath: string
}

export async function extractMediaForSentences(
  videoPath: string,
  sentences: SelectedSentence[],
  mediaDir: string,
  signal?: AbortSignal
): Promise<Map<number, MediaFiles>> {
  const ffmpeg = getFfmpegPath()
  const paddingMs = getSettingsRepo().get('audioPaddingMs')
  const paddingSec = paddingMs / 1000
  const results = new Map<number, MediaFiles>()
  const concurrency = 4

  // Process in batches
  for (let i = 0; i < sentences.length; i += concurrency) {
    if (signal?.aborted) throw new Error('Media extraction cancelled')
    const batch = sentences.slice(i, i + concurrency)
    const promises = batch.map((s) =>
      extractSingle(ffmpeg, videoPath, s, mediaDir, paddingSec, signal)
    )
    const batchResults = await Promise.all(promises)
    for (const [idx, files] of batchResults) {
      results.set(idx, files)
    }
  }

  return results
}

async function extractSingle(
  ffmpeg: string,
  videoPath: string,
  sentence: SelectedSentence,
  mediaDir: string,
  paddingSec: number,
  signal?: AbortSignal
): Promise<[number, MediaFiles]> {
  const start = Math.max(0, sentence.startTime - paddingSec)
  const duration = sentence.endTime - sentence.startTime + paddingSec * 2
  const midTime = (sentence.startTime + sentence.endTime) / 2

  const audioPath = join(mediaDir, `audio_${sentence.index}.mp3`)
  const imagePath = join(mediaDir, `image_${sentence.index}.jpg`)

  await Promise.all([
    runFfmpeg(ffmpeg, [
      '-ss', String(start),
      '-i', videoPath,
      '-t', String(duration),
      '-vn', '-acodec', 'libmp3lame', '-q:a', '4',
      '-y', audioPath
    ], signal),
    runFfmpeg(ffmpeg, [
      '-ss', String(midTime),
      '-i', videoPath,
      '-frames:v', '1',
      '-q:v', '3',
      '-y', imagePath
    ], signal)
  ])

  logger.debug(`Extracted media for sentence ${sentence.index}`)
  return [sentence.index, { audioPath, imagePath }]
}

function runFfmpeg(ffmpeg: string, args: string[], signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    if (signal) {
      signal.addEventListener('abort', () => proc.kill('SIGTERM'))
    }
    let stderr = ''
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg failed: ${stderr.slice(0, 200)}`))
    })
    proc.on('error', reject)
  })
}
