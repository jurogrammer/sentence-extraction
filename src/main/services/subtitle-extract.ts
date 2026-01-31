import { readFileSync } from 'fs'
import { parse as parseSrt } from 'subtitle'
import type { TimedSentence } from '../../shared/types'

export function parseSubtitleFile(filePath: string): TimedSentence[] {
  const content = readFileSync(filePath, 'utf-8')

  if (filePath.endsWith('.vtt')) {
    return parseVtt(content)
  }
  return parseSrtContent(content)
}

function parseSrtContent(content: string): TimedSentence[] {
  const nodes = parseSrt(content)
  const sentences: TimedSentence[] = []

  for (const node of nodes) {
    if (node.type === 'cue') {
      const text = stripTags(node.data.text).trim()
      if (!text) continue
      sentences.push({
        index: sentences.length,
        startTime: node.data.start / 1000,
        endTime: node.data.end / 1000,
        text
      })
    }
  }

  return mergeDuplicates(sentences)
}

function parseVtt(content: string): TimedSentence[] {
  // VTT is close enough to SRT that the subtitle lib handles it,
  // but we strip the WEBVTT header first
  const cleaned = content.replace(/^WEBVTT.*?\n\n/s, '')
  return parseSrtContent(cleaned)
}

function stripTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\{[^}]+\}/g, '')
    .replace(/\n/g, ' ')
    .trim()
}

/** Merge consecutive cues with identical text (common in auto-subs) */
function mergeDuplicates(sentences: TimedSentence[]): TimedSentence[] {
  const merged: TimedSentence[] = []
  for (const s of sentences) {
    const prev = merged[merged.length - 1]
    if (prev && prev.text === s.text) {
      prev.endTime = s.endTime
    } else {
      merged.push({ ...s, index: merged.length })
    }
  }
  return merged
}
