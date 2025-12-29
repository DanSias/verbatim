import OpenAI from 'openai'
import type { LLMProvider, LLMCompletionInput } from '../types'

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async complete(input: LLMCompletionInput) {
    const res = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
      messages: input.messages,
      temperature: input.temperature ?? 0,
    })

    return { text: res.choices[0]?.message?.content ?? '' }
  }
}
