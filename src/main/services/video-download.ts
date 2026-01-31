import { spawn } from 'child_process'
import { join } from 'path'
import { getYtDlpPath } from '../utils/bin-paths'
import { logger } from '../utils/logger'

export interface DownloadResult {
  videoPath: string
  subtitlePath: string | null
}

export async function downloadVideo(
  url: string,
  tempDir: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<DownloadResult> {
  const ytDlp = getYtDlpPath()
  const outputTemplate = join(tempDir, '%(id)s.%(ext)s')

  // First, download with subtitles
  await runYtDlp(
    ytDlp,
    [
      url,
      '-o', outputTemplate,
      '--write-subs',
      '--write-auto-subs',
      '--sub-lang', 'en,ko,ja,zh',
      '--sub-format', 'srt/vtt/best',
      '--no-playlist',
      '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--newline'
    ],
    onProgress,
    signal
  )

  // Find downloaded files
  const { readdirSync } = await import('fs')
  const files = readdirSync(tempDir)
  const videoFile = files.find((f) => /\.(mp4|mkv|webm)$/.test(f))
  const subFile = files.find((f) => /\.(srt|vtt)$/.test(f))

  if (!videoFile) throw new Error('Video download failed: no video file found')

  return {
    videoPath: join(tempDir, videoFile),
    subtitlePath: subFile ? join(tempDir, subFile) : null
  }
}

function runYtDlp(
  bin: string,
  args: string[],
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    if (signal) {
      signal.addEventListener('abort', () => {
        proc.kill('SIGTERM')
        reject(new Error('Download cancelled'))
      })
    }

    let stderr = ''
    proc.stdout.on('data', (data: Buffer) => {
      const line = data.toString()
      const match = line.match(/(\d+(?:\.\d+)?)%/)
      if (match && onProgress) {
        onProgress(parseFloat(match[1]))
      }
    })
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        logger.error('yt-dlp failed', stderr)
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr.slice(0, 200)}`))
      }
    })
    proc.on('error', reject)
  })
}
