'use client'

import { useEffect, useState } from 'react'
import type { Workspace, WorkspaceSummary } from '@/lib/types'
import { loadLastWorkspace, saveLastWorkspace } from '@/lib/workspaceStorage'

type Props = {
  value: Workspace | null
  onChange: (ws: Workspace | null) => void
}

export function WorkspacePicker({ value, onChange }: Props) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch('/api/workspaces')
      const data = (await res.json()) as { workspaces: WorkspaceSummary[] }
      setWorkspaces(data.workspaces ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // load last workspace first
    const last = loadLastWorkspace()
    if (last && !value) onChange(last)

    // then fetch list
    refresh().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Workspace</div>
        <button
          type="button"
          onClick={() => refresh().catch(() => {})}
          className="text-xs text-slate-300 underline underline-offset-2 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <select
        value={value?.id ?? ''}
        onChange={(e) => {
          const id = e.target.value
          const ws = workspaces.find((w) => w.id === id)
          if (!ws) return
          const next = { id: ws.id, name: ws.name }
          onChange(next)
          saveLastWorkspace(next)
        }}
        className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
      >
        <option value="" disabled>
          Select a workspace…
        </option>
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>

      {value && (
        <div className="text-xs text-slate-400">
          Active: {value.name} ({value.id})
        </div>
      )}
    </div>
  )
}
