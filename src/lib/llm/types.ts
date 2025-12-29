export type LLMMessage = {
  role: 'system' | 'user'
  content: string
}

export type LLMCompletionInput = {
  messages: LLMMessage[]
  temperature?: number
}

export type LLMCompletionResult = {
  text: string
}

export interface LLMProvider {
  complete(input: LLMCompletionInput): Promise<LLMCompletionResult>
}
