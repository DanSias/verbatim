'use client'

import { useState, useEffect } from 'react'
const LAST_WORKSPACE_KEY = 'verbatim:lastWorkspace'
type IngestResult = {
  workspace: {
    id: string
    name: string
  }
  document: {
    id: string
    filename: string
  }
  chunkCount: number
}

type Citation = {
  id: number
  documentId: string
  filename: string
  chunkId: string
  headingPath: string
  excerpt: string
}

type AskResult = {
  answer: string
  citations: Citation[]
}

export default function Home() {
  const [workspaceName, setWorkspaceName] = useState('Demo')
  const [activeWorkspace, setActiveWorkspace] = useState<{
    id: string
    name: string
  } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<IngestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [question, setQuestion] = useState('')
  const [askResult, setAskResult] = useState<AskResult | null>(null)
  const [isAsking, setIsAsking] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(LAST_WORKSPACE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { id: string; name: string }
      if (parsed?.id) setActiveWorkspace(parsed)
    } catch {
      // ignore
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)

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
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Upload failed')
      setResult(data)
      setActiveWorkspace(data.workspace)
      localStorage.setItem(LAST_WORKSPACE_KEY, JSON.stringify(data.workspace))
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Upload failed')
      }
    } finally {
      setIsUploading(false)
    }
  }

  async function ask() {
    setError(null)
    setAskResult(null)

    if (!activeWorkspace?.id) {
      setError('Upload a document first so we have a workspace to query.')
      return
    }
    if (!question.trim()) {
      setError('Enter a question first.')
      return
    }

    setIsAsking(true)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          question: question.trim(),
        }),
      })
      const raw = await res.text()

      let data: (AskResult & { error?: string }) | null = null
      try {
        data = JSON.parse(raw)
      } catch {
        // non-JSON response (e.g. HTML error page)
      }
      if (!res.ok) {
        throw new Error(data?.error ?? `Ask failed (${res.status})`)
      }

      if (!data) {
        throw new Error('Ask failed: server returned a non-JSON response.')
      }

      setAskResult(data)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('Ask failed')
    } finally {
      setIsAsking(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold">Verbatim</h1>
        <p className="mt-2 text-sm text-slate-300">
          Upload a document to create chunks (v1).
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <div className="text-sm font-medium">Workspace</div>
            <input
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="e.g. Demo"
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium">File (.md or .txt)</div>
            <input
              type="file"
              accept=".md,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm"
            />
          </label>

          <button
            type="submit"
            disabled={isUploading}
            className="rounded bg-black px-4 py-2 text-sm font-medium text-slate-300 disabled:opacity-50"
          >
            {isUploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {result && (
          <pre className="mt-6 overflow-auto rounded border border-slate-700 bg-slate-600 p-3 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        <div className="mt-10 border-t pt-6">
          <h2 className="text-lg font-semibold">Ask</h2>
          {activeWorkspace && (
            <div className="mt-2 text-xs text-slate-400">
              Active workspace: {activeWorkspace.name} ({activeWorkspace.id})
            </div>
          )}
          <p className="mt-1 text-sm text-slate-300">
            v1 uses simple keyword matching. Next we’ll add LLM answers +
            citations.
          </p>

          <div className="mt-4 space-y-3">
            <label className="block">
              <div className="text-sm font-medium">Question</div>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
                placeholder="e.g. How many webhook retries?"
              />
            </label>

            <button
              type="button"
              onClick={ask}
              disabled={isAsking}
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isAsking ? 'Asking…' : 'Ask'}
            </button>
          </div>

          {askResult && (
            <div className="mt-6 space-y-4">
              <div className="rounded border border-slate-800 bg-slate-900 p-4">
                <div className="text-sm font-semibold">Answer</div>
                <div className="mt-2 text-sm">{askResult.answer}</div>
              </div>

              <div className="rounded border border-slate-800 bg-slate-900 p-4">
                <div className="text-sm font-semibold">Citations</div>
                {askResult.citations.length === 0 ? (
                  <div className="mt-2 text-sm text-slate-300">None</div>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {askResult.citations.map((c) => (
                      <li key={c.chunkId} className="text-sm">
                        <div className="font-medium">
                          [{c.id}] {c.filename}
                        </div>
                        {c.headingPath && (
                          <div className="text-xs text-slate-100">
                            {c.headingPath}
                          </div>
                        )}
                        <div className="mt-1 rounded bg-slate-600 p-2 text-xs">
                          {c.excerpt}
                          {c.excerpt.length >= 400 ? '…' : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
