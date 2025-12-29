import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, createdAt: true },
  })

  return NextResponse.json({ workspaces })
}
