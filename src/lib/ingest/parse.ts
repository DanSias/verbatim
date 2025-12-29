export type ParsedDoc = {
  filename: string
  text: string
}

export async function parseTextFile(file: File): Promise<ParsedDoc> {
  const filename = file.name
  const text = await file.text()

  // v1: treat markdown as plain text (we’ll get heading-aware chunking next)
  return { filename, text }
}