import type { Workspace } from '@/lib/types'

export const LAST_WORKSPACE_KEY = 'verbatim:lastWorkspace'

export function loadLastWorkspace(): Workspace | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(LAST_WORKSPACE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Workspace
    return parsed?.id ? parsed : null
  } catch {
    return null
  }
}

export function saveLastWorkspace(ws: Workspace) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LAST_WORKSPACE_KEY, JSON.stringify(ws))
}
