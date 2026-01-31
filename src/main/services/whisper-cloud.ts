import { createReadStream } from 'fs'
import OpenAI from 'openai'
import type { TimedSentence } from '../../shared/types'
import { getSettingsRepo } from '../db/settings-repo'
import { logger } from '../utils/logger'

export async function transcribeCloud(audioPath: string): Promise<TimedSentence[]> {
  const settings = getSettingsRepo()
  const apiKey = settings.get('openaiApiKey')
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const client = new OpenAI({ apiKey })

  logger.info('Transcribing with OpenAI Whisper API...')

  const response = await client.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment']
  })

  const segments = (response as unknown as { segments?: Segment[] }).segments || []

  return segments.map((seg, i) => ({
    index: i,
    startTime: seg.start,
    endTime: seg.end,
    text: seg.text.trim()
  }))
}

interface Segment {
  start: number
  end: number
  text: string
}
