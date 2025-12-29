import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseTextFile } from '@/lib/ingest/parse'
import { chunkMarkdown } from '@/lib/ingest/chunk'
import { sha256 } from '@/lib/ingest/hash'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const form = await req.formData()

  const file = form.get('file')
  const workspaceName = String(form.get('workspaceName') ?? 'Default')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  const parsed = await parseTextFile(file)
  const contentHash = sha256(parsed.text)
  const chunks = chunkMarkdown(parsed.text)

  // 1) get or create workspace
  const workspace =
    (await prisma.workspace.findFirst({ where: { name: workspaceName } })) ??
    (await prisma.workspace.create({ data: { name: workspaceName } }))

  // 2) create document
  const doc = await prisma.document.upsert({
    where: {
      workspaceId_contentHash: {
        workspaceId: workspace.id,
        contentHash,
      },
    },
    update: {
      filename: parsed.filename,
    },
    create: {
      workspaceId: workspace.id,
      filename: parsed.filename,
      contentHash,
    },
  })

  // 3) create chunks
  const existingChunkCount = await prisma.chunk.count({
    where: { documentId: doc.id },
  })

  if (existingChunkCount === 0) {
    await prisma.chunk.createMany({
      data: chunks.map((c) => ({
        documentId: doc.id,
        content: c.content,
        headingPath: c.headingPath.join(' > '),
      })),
    })
  }

  return NextResponse.json({
    workspace: { id: workspace.id, name: workspace.name },
    document: { id: doc.id, filename: doc.filename, contentHash },
    chunkCount: chunks.length,
    chunksInserted: existingChunkCount === 0 ? chunks.length : 0,
  })
}
