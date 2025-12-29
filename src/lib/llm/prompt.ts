import { readFile } from 'node:fs/promises'
import path from 'node:path'

export async function loadVerbatimSystemPrompt() {
  const p = path.join(process.cwd(), 'prompts', 'verbatim-system.txt')
  return readFile(p, 'utf8')
}
