'use client';

/**
 * useActiveWorkspace Hook
 *
 * Manages active workspace state in localStorage with cross-tab synchronization.
 * Provides a consistent interface for reading/writing the active workspace.
 */

import { useState, useEffect, useCallback } from 'react';

/** LocalStorage keys (shared across all Pilot pages) */
export const LS_WORKSPACE_ID = 'verbatim_pilot_workspaceId';
export const LS_WORKSPACE_NAME = 'verbatim_pilot_workspaceName';

/** Custom event name for workspace changes within the same tab */
export const WORKSPACE_CHANGE_EVENT = 'verbatim:workspace-change';

/** Active workspace data */
export interface ActiveWorkspace {
  id: string;
  name: string;
}

/** Return type for the hook */
export interface UseActiveWorkspaceReturn {
  /** Currently active workspace, or null if none selected */
  activeWorkspace: ActiveWorkspace | null;
  /** Set the active workspace (persists to localStorage and dispatches event) */
  setActiveWorkspace: (workspace: ActiveWorkspace | null) => void;
  /** Whether the hook has initialized (read from localStorage) */
  isLoaded: boolean;
}

/**
 * Read active workspace from localStorage.
 * Returns null if not set or if parsing fails.
 */
export function getActiveWorkspaceFromStorage(): ActiveWorkspace | null {
  if (typeof window === 'undefined') return null;

  try {
    const id = localStorage.getItem(LS_WORKSPACE_ID);
    const name = localStorage.getItem(LS_WORKSPACE_NAME);

    if (id && name) {
      return { id, name };
    }
    return null;
  } catch {
    // localStorage might be unavailable (private browsing, etc.)
    return null;
  }
}

/**
 * Write active workspace to localStorage and dispatch change event.
 */
export function setActiveWorkspaceInStorage(workspace: ActiveWorkspace | null): void {
  if (typeof window === 'undefined') return;

  try {
    if (workspace) {
      localStorage.setItem(LS_WORKSPACE_ID, workspace.id);
      localStorage.setItem(LS_WORKSPACE_NAME, workspace.name);
    } else {
      localStorage.removeItem(LS_WORKSPACE_ID);
      localStorage.removeItem(LS_WORKSPACE_NAME);
    }

    // Dispatch custom event for same-tab listeners
    window.dispatchEvent(new CustomEvent(WORKSPACE_CHANGE_EVENT, { detail: workspace }));
  } catch {
    // localStorage might be unavailable
    console.warn('Failed to persist workspace to localStorage');
  }
}

/**
 * Hook to manage active workspace state.
 *
 * Features:
 * - Reads initial state from localStorage on mount
 * - Persists changes to localStorage
 * - Syncs across tabs via storage event
 * - Syncs within same tab via custom event
 *
 * @example
 * const { activeWorkspace, setActiveWorkspace, isLoaded } = useActiveWorkspace();
 *
 * if (!isLoaded) return <Loading />;
 *
 * if (activeWorkspace) {
 *   console.log(`Active: ${activeWorkspace.name}`);
 * }
 *
 * // Change workspace
 * setActiveWorkspace({ id: 'ws_123', name: 'My Workspace' });
 */
export function useActiveWorkspace(): UseActiveWorkspaceReturn {
  const [activeWorkspace, setActiveWorkspaceState] = useState<ActiveWorkspace | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Read from localStorage on mount
  useEffect(() => {
    const stored = getActiveWorkspaceFromStorage();
    setActiveWorkspaceState(stored);
    setIsLoaded(true);
  }, []);

  // Listen for storage events (cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LS_WORKSPACE_ID || event.key === LS_WORKSPACE_NAME) {
        const stored = getActiveWorkspaceFromStorage();
        setActiveWorkspaceState(stored);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Listen for custom event (same-tab sync from other components)
  useEffect(() => {
    const handleWorkspaceChange = (event: Event) => {
      const customEvent = event as CustomEvent<ActiveWorkspace | null>;
      setActiveWorkspaceState(customEvent.detail);
    };

    window.addEventListener(WORKSPACE_CHANGE_EVENT, handleWorkspaceChange);
    return () => window.removeEventListener(WORKSPACE_CHANGE_EVENT, handleWorkspaceChange);
  }, []);

  // Setter that persists to storage
  const setActiveWorkspace = useCallback((workspace: ActiveWorkspace | null) => {
    setActiveWorkspaceInStorage(workspace);
    setActiveWorkspaceState(workspace);
  }, []);

  return {
    activeWorkspace,
    setActiveWorkspace,
    isLoaded,
  };
}
