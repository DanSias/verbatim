import OpenAI from 'openai'
import type { LLMProvider, LLMCompletionInput } from '../types'

export class GeminiOpenAIProvider implements LLMProvider {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    })
  }

  async complete(input: LLMCompletionInput) {
    const res = await this.client.chat.completions.create({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      messages: input.messages,
      temperature: input.temperature ?? 0,
    })

    return { text: res.choices[0]?.message?.content ?? '' }
  }
}
