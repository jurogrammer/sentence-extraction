import type { TimedSentence, SelectedSentence } from '../../shared/types'

export interface AiProvider {
  selectSentences(
    sentences: TimedSentence[],
    targetLang: string,
    nativeLang: string,
    maxCards: number
  ): Promise<SelectedSentence[]>
}
