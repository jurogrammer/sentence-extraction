import type { AiProvider } from './ai-provider'
import type { TimedSentence, SelectedSentence } from '../../shared/types'
import { getSettingsRepo } from '../db/settings-repo'
import { logger } from '../utils/logger'

export class OllamaProvider implements AiProvider {
  async selectSentences(
    sentences: TimedSentence[],
    targetLang: string,
    nativeLang: string,
    maxCards: number
  ): Promise<SelectedSentence[]> {
    const settings = getSettingsRepo()
    const baseUrl = settings.get('ollamaUrl')
    const model = settings.get('ollamaModel')

    const prompt = buildPrompt(sentences, targetLang, nativeLang, maxCards)
    logger.info(`Requesting sentence selection from Ollama (${model})...`)

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        format: 'json',
        stream: false,
        options: { temperature: 0.3 }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as { response: string }
    const parsed = JSON.parse(data.response) as { selections: RawSelection[] }
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
  return `You are a language learning assistant. Select up to ${maxCards} sentences most useful for a ${nativeLang}-speaking learner studying ${targetLang}.

For each selected sentence, provide index, translation into ${nativeLang}, and reason (in ${nativeLang}).

Respond ONLY with JSON: {"selections": [{"index": 0, "translation": "...", "reason": "..."}]}

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
