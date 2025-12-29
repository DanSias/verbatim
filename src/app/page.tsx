'use client'

import { useState } from 'react'
import type { IngestResult, Workspace } from '@/lib/types'
import { WorkspacePicker } from '@/components/workspace-picker'
import { IngestForm } from '@/components/ingest-form'
import { AskForm } from '@/components/ask-form'

export default function Home() {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold">Verbatim</h1>
        <p className="mt-2 text-sm text-slate-300">
          Upload docs, then ask questions grounded in those docs.
        </p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-6">
          <WorkspacePicker
            value={activeWorkspace}
            onChange={setActiveWorkspace}
          />
        </div>

        <IngestForm
          onIngested={setIngestResult}
          onWorkspaceSelected={setActiveWorkspace}
          setError={setError}
        />

        {ingestResult && (
          <pre className="mt-6 overflow-auto rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs text-slate-200">
            {JSON.stringify(ingestResult, null, 2)}
          </pre>
        )}

        <AskForm workspace={activeWorkspace} setError={setError} />
      </div>
    </main>
  )
}
