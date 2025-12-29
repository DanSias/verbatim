import type { LLMProvider } from './types'
import { OpenAIProvider } from './providers/openai'
import { GeminiOpenAIProvider } from './providers/gemini-openai'

export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER ?? 'openai'

  if (provider === 'openai') {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error('OPENAI_API_KEY not set')
    return new OpenAIProvider(key)
  }

  if (provider === 'gemini') {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('GEMINI_API_KEY not set')
    return new GeminiOpenAIProvider(key)
  }

  throw new Error(`Unknown LLM provider: ${provider}`)
}
