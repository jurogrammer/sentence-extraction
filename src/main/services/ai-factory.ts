import type { AiProvider } from './ai-provider'
import { OpenAiProvider } from './ai-openai'
import { OllamaProvider } from './ai-ollama'
import { getSettingsRepo } from '../db/settings-repo'

export function getAiProvider(): AiProvider {
  const provider = getSettingsRepo().get('aiProvider')
  switch (provider) {
    case 'openai':
      return new OpenAiProvider()
    case 'ollama':
      return new OllamaProvider()
    default:
      throw new Error(`Unknown AI provider: ${provider}`)
  }
}
