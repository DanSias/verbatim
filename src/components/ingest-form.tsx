'use client'

import { useState } from 'react'
import type { IngestResult, Workspace } from '@/lib/types'
import { saveLastWorkspace } from '@/lib/workspaceStorage'

type Props = {
  onIngested: (r: IngestResult) => void
  onWorkspaceSelected: (ws: Workspace) => void
  setError: (msg: string | null) => void
}

export function IngestForm({
  onIngested,
  onWorkspaceSelected,
  setError,
}: Props) {
  const [workspaceName, setWorkspaceName] = useState('Demo')
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!file) {
      setError('Choose a file first.')
      return
    }

    const form = new FormData()
    form.append('workspaceName', workspaceName)
    form.append('file', file)

    setIsUploading(true)
    try {
      const res = await fetch('/api/ingest', { method: 'POST', body: form })
      const raw = await res.text()
      const data = JSON.parse(raw) as IngestResult & { error?: string }
      if (!res.ok) throw new Error(data?.error ?? 'Upload failed')

      onIngested(data)
      onWorkspaceSelected(data.workspace)
      saveLastWorkspace(data.workspace)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block">
        <div className="text-sm font-medium">
          Workspace name (create on upload)
        </div>
        <input
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500"
          placeholder="e.g. Demo"
        />
      </label>

      <label className="block">
        <div className="text-sm font-medium">File (.md or .txt)</div>
        <input
          type="file"
          accept=".md,.txt"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm text-slate-200"
        />
      </label>

      <button
        type="submit"
        disabled={isUploading}
        className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
      >
        {isUploading ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  )
}
