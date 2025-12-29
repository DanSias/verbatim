'use client'

import { useState } from 'react'
import type { AskResult, Workspace } from '@/lib/types'

type Props = {
  workspace: Workspace | null
  setError: (msg: string | null) => void
}

export function AskForm({ workspace, setError }: Props) {
  const [question, setQuestion] = useState('')
  const [askResult, setAskResult] = useState<AskResult | null>(null)
  const [isAsking, setIsAsking] = useState(false)

  async function ask() {
    setError(null)
    setAskResult(null)

    if (!workspace?.id) {
      setError('Select a workspace (or upload a document) first.')
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
          workspaceId: workspace.id,
          question: question.trim(),
        }),
      })

      const raw = await res.text()
      let data: (AskResult & { error?: string }) | null = null
      try {
        data = JSON.parse(raw)
      } catch {}

      if (!res.ok) throw new Error(data?.error ?? `Ask failed (${res.status})`)
      if (!data)
        throw new Error('Ask failed: server returned a non-JSON response.')

      setAskResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ask failed')
    } finally {
      setIsAsking(false)
    }
  }

  return (
    <div className="mt-10 border-t border-slate-800 pt-6">
      <h2 className="text-lg font-semibold">Ask</h2>
      <p className="mt-1 text-sm text-slate-300">
        Answers are grounded in your uploaded docs and must cite sources.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block">
          <div className="text-sm font-medium">Question</div>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500"
            placeholder='e.g. "How many retries?"'
          />
        </label>

        <button
          type="button"
          onClick={ask}
          disabled={isAsking}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          {isAsking ? 'Asking…' : 'Ask'}
        </button>
      </div>

      {askResult && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm font-semibold">Answer</div>
            <div className="mt-2 text-sm text-slate-100 whitespace-pre-wrap">
              {askResult.answer}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
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
                      <div className="text-xs text-slate-400">
                        {c.headingPath}
                      </div>
                    )}
                    <div className="mt-1 rounded border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-200">
                      {c.excerpt}
                      {c.excerpt.length >= 800 ? '…' : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
