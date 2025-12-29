export type Chunk = {
  content: string
  headingPath: string[] // e.g. ["Webhooks", "Retries"]
}

/**
 * v1 chunker:
 * - splits by markdown headings (#, ##, ###)
 * - builds headingPath
 * - splits large sections into ~maxChars with overlap
 */
export function chunkMarkdown(
  text: string,
  opts?: { maxChars?: number; overlapChars?: number }
): Chunk[] {
  const maxChars = opts?.maxChars ?? 4000
  const overlapChars = opts?.overlapChars ?? 400

  const lines = text.split('\n')
  const chunks: Chunk[] = []

  let currentPath: string[] = []
  let buffer: string[] = []

  function flushSection() {
    const sectionText = buffer.join('\n').trim()
    buffer = []
    if (!sectionText) return

    // If small enough, keep as one chunk
    if (sectionText.length <= maxChars) {
      chunks.push({ content: sectionText, headingPath: [...currentPath] })
      return
    }

    // Otherwise split into overlapping windows
    let start = 0
    while (start < sectionText.length) {
      const end = Math.min(start + maxChars, sectionText.length)
      const window = sectionText.slice(start, end).trim()
      if (window) chunks.push({ content: window, headingPath: [...currentPath] })
      if (end === sectionText.length) break
      start = Math.max(0, end - overlapChars)
    }
  }

  for (const line of lines) {
    const m = /^(#{1,6})\s+(.*)\s*$/.exec(line)
    if (m) {
      // new heading begins → flush previous section
      flushSection()

      const level = m[1].length
      const title = m[2].trim()

      // update heading path to this level
      currentPath = currentPath.slice(0, level - 1)
      currentPath[level - 1] = title

      // keep heading in the section buffer as context
      buffer.push(line)
    } else {
      buffer.push(line)
    }
  }

  flushSection()
  return chunks
}