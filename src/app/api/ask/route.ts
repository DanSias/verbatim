import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { LLMMessage } from '@/lib/llm/types'
import { getLLMProvider } from '@/lib/llm'
import { loadVerbatimSystemPrompt } from '@/lib/llm/prompt'
import { extractKeywords } from '@/lib/retrieval/query'

export const runtime = 'nodejs'

type AskBody = {
  workspaceId: string
  question: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<AskBody>
    const workspaceId = body.workspaceId?.trim()
    const question = body.question?.trim()

    if (!workspaceId || !question) {
      return NextResponse.json(
        { error: 'workspaceId and question are required' },
        { status: 400 }
      )
    }

    const keywords = extractKeywords(question)

    const chunks = await prisma.chunk.findMany({
      where: {
        document: { workspaceId },
        AND: keywords.map((k) => ({
          content: { contains: k, mode: 'insensitive' },
        })),
      },
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: { document: { select: { id: true, filename: true } } },
    })

    const seen = new Set<string>()
    const unique = []
    for (const c of chunks) {
      const key = `${c.document.filename}::${c.headingPath}::${c.content.slice(0, 200)}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(c)
    }
    const finalChunks = unique.slice(0, 6)

    if (finalChunks.length === 0) {
      return NextResponse.json({
        answer: 'I don’t see this information in the provided documents.',
        citations: [],
      })
    }

    const citations = finalChunks.map((c, i) => ({
      id: i + 1,
      documentId: c.document.id,
      filename: c.document.filename,
      chunkId: c.id,
      headingPath: c.headingPath,
      excerpt: c.content.slice(0, 800),
    }))

    const system = await loadVerbatimSystemPrompt()

    const sourcesBlock = citations
      .map(
        (c) =>
          `SOURCE [${c.id}]\nFILE: ${c.filename}\nHEADING: ${
            c.headingPath || '(none)'
          }\nEXCERPT:\n${c.excerpt}\n`
      )
      .join('\n')

    const userPrompt = `Question: ${question}

You have the following sources. Use ONLY these sources when answering.

${sourcesBlock}

Return:
1) A direct answer.
2) A Sources section that lists which SOURCE numbers support the answer (e.g. Sources: [1], [3]).
If the answer is not supported, say: "I don’t see this information in the provided documents."
`

    const messages: LLMMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ]

    const llm = getLLMProvider()
    const out = await llm.complete({ messages, temperature: 0 })

    return NextResponse.json({ answer: out.text, citations })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ask failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
