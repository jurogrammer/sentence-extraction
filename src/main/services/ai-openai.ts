import OpenAI from 'openai'
import type { AiProvider } from './ai-provider'
import type { TimedSentence, SelectedSentence } from '../../shared/types'
import { getSettingsRepo } from '../db/settings-repo'
import { logger } from '../utils/logger'

export class OpenAiProvider implements AiProvider {
  async selectSentences(
    sentences: TimedSentence[],
    targetLang: string,
    nativeLang: string,
    maxCards: number
  ): Promise<SelectedSentence[]> {
    const settings = getSettingsRepo()
    const apiKey = settings.get('openaiApiKey')
    if (!apiKey) throw new Error('OpenAI API key not configured')

    const client = new OpenAI({ apiKey })
    const model = settings.get('openaiModel')

    const prompt = buildPrompt(sentences, targetLang, nativeLang, maxCards)
    logger.info(`Requesting sentence selection from OpenAI (${model})...`)

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a language learning assistant. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Empty response from OpenAI')

    const parsed = JSON.parse(content) as { selections: RawSelection[] }
    return mapSelections(parsed.selections, sentences)
  }
}

interface RawSelection {
  index: number
  translation: string
  reason: string
}

function buildPrompt(
  sentences: TimedSentence[],
  targetLang: string,
  nativeLang: string,
  maxCards: number
): string {
  const numbered = sentences.map((s) => `[${s.index}] ${s.text}`).join('\n')
  return `Below are timestamped sentences from a video in ${targetLang}.

Select up to ${maxCards} sentences that are most useful for a ${nativeLang}-speaking learner studying ${targetLang}.

Prefer sentences that:
- Use common, practical vocabulary
- Are grammatically complete
- Illustrate useful patterns or expressions
- Are varied in topic and difficulty

For each selected sentence, provide:
- index: the original index number
- translation: translation into ${nativeLang}
- reason: brief reason why this sentence is useful (in ${nativeLang})

Respond with JSON: {"selections": [{"index": 0, "translation": "...", "reason": "..."}]}

Sentences:
${numbered}`
}

function mapSelections(selections: RawSelection[], sentences: TimedSentence[]): SelectedSentence[] {
  const byIndex = new Map(sentences.map((s) => [s.index, s]))
  return selections
    .filter((sel) => byIndex.has(sel.index))
    .map((sel) => ({
      ...byIndex.get(sel.index)!,
      translation: sel.translation,
      reason: sel.reason
    }))
}
