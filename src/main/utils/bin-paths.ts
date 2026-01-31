import { execFileSync } from 'child_process'

function which(bin: string): string | null {
  try {
    return execFileSync('which', [bin], { encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

export function getFfmpegPath(): string {
  const p = which('ffmpeg')
  if (!p) throw new Error('ffmpeg not found. Please install ffmpeg and ensure it is in your PATH.')
  return p
}

export function getFfprobePath(): string {
  const p = which('ffprobe')
  if (!p) throw new Error('ffprobe not found. Please install ffmpeg and ensure it is in your PATH.')
  return p
}

export function getYtDlpPath(): string {
  const p = which('yt-dlp')
  if (!p) throw new Error('yt-dlp not found. Please install yt-dlp and ensure it is in your PATH.')
  return p
}
