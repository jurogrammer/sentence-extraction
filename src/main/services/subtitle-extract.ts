import { readFileSync } from 'fs'
import { parse as parseSrt } from 'subtitle'
import { parse as parseAssFile } from 'ass-compiler'
import type { TimedSentence } from '../../shared/types'

export function parseSubtitleFile(filePath: string): TimedSentence[] {
  const content = readFileSync(filePath, 'utf-8')

  if (filePath.endsWith('.vtt')) {
    return parseVtt(content)
  }
  if (filePath.endsWith('.ass') || filePath.endsWith('.ssa')) {
    return parseAss(content)
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

function parseAss(content: string): TimedSentence[] {
  const parsed = parseAssFile(content)
  const sentences: TimedSentence[] = []

  for (const dialogue of parsed.events.dialogue) {
    const text = stripTags(dialogue.Text.combined).trim()
    if (!text) continue
    sentences.push({
      index: sentences.length,
      startTime: dialogue.Start / 1000,
      endTime: dialogue.End / 1000,
      text
    })
  }

  return mergeDuplicates(sentences)
}

function stripTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, '') // HTML tags
    .replace(/\{[^}]+\}/g, '') // ASS/SSA style tags: {\tag}, {\\tag}
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
