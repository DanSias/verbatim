'use client';

/**
 * WorkspaceSwitcher
 *
 * A dropdown menu for selecting the active workspace.
 * Inspired by OpenAI's Projects menu.
 *
 * Features:
 * - Displays current workspace name
 * - Dropdown with workspace list (searchable)
 * - Quick create new workspace
 * - Link to manage workspaces
 * - Keyboard accessible (arrow keys, Enter, Escape)
 * - ARIA compliant
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ChevronDown, Check, Plus, Settings, Search, AlertCircle, Loader2 } from 'lucide-react';
import { useActiveWorkspace, type ActiveWorkspace } from './useActiveWorkspace';
import { CreateWorkspaceModal, type CreatedWorkspace } from './CreateWorkspaceModal';

/** Workspace from API */
interface Workspace {
  id: string;
  name: string;
  createdAt: string;
}

/** API response for listing workspaces */
interface WorkspacesResponse {
  workspaces: Workspace[];
}

export function WorkspaceSwitcher() {
  const { activeWorkspace, setActiveWorkspace, isLoaded } = useActiveWorkspace();

  // Dropdown state
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Workspaces data
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Fetch workspaces when dropdown opens
  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/workspaces');

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Unexpected server response');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Error: ${response.status}`);
      }

      setWorkspaces((data as WorkspacesResponse).workspaces);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Open dropdown
  const openDropdown = useCallback(() => {
    setIsOpen(true);
    setSearchQuery('');
    setFocusedIndex(-1);
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Close dropdown
  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setFocusedIndex(-1);
    buttonRef.current?.focus();
  }, []);

  // Toggle dropdown
  const toggleDropdown = useCallback(() => {
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }, [isOpen, openDropdown, closeDropdown]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeDropdown]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDropdown]);

  // Filter workspaces by search query
  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery.trim()) return workspaces;
    const query = searchQuery.toLowerCase();
    return workspaces.filter((ws) => ws.name.toLowerCase().includes(query));
  }, [workspaces, searchQuery]);

  // Total selectable items: filtered workspaces + Create + Manage
  const totalItems = filteredWorkspaces.length + 2;

  // Handle selecting a workspace
  const handleSelectWorkspace = useCallback(
    (workspace: Workspace) => {
      setActiveWorkspace({ id: workspace.id, name: workspace.name });
      closeDropdown();
    },
    [setActiveWorkspace, closeDropdown]
  );

  // Handle workspace created
  const handleWorkspaceCreated = useCallback(
    (workspace: CreatedWorkspace) => {
      // Add to list
      setWorkspaces((prev) => [workspace, ...prev]);
      // Set as active
      setActiveWorkspace({ id: workspace.id, name: workspace.name });
      // Close modal and dropdown
      setIsCreateModalOpen(false);
      closeDropdown();
    },
    [setActiveWorkspace, closeDropdown]
  );

  // Handle keyboard navigation in dropdown
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
          break;
        case 'Enter':
          event.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < filteredWorkspaces.length) {
            // Select workspace
            handleSelectWorkspace(filteredWorkspaces[focusedIndex]);
          } else if (focusedIndex === filteredWorkspaces.length) {
            // Create workspace
            setIsCreateModalOpen(true);
          } else if (focusedIndex === filteredWorkspaces.length + 1) {
            // Manage workspaces - click the link
            closeDropdown();
            // Navigation handled by Link component
          }
          break;
        case 'Tab':
          // Allow tab to close dropdown naturally
          closeDropdown();
          break;
      }
    },
    [isOpen, focusedIndex, totalItems, filteredWorkspaces, handleSelectWorkspace, closeDropdown]
  );

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"], [role="menuitem"]');
      const focusedItem = items[focusedIndex] as HTMLElement;
      focusedItem?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  // Don't render until localStorage is loaded
  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        {/* Trigger Button */}
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleDropdown}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && !isOpen) {
              e.preventDefault();
              openDropdown();
            }
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-900 transition-colors max-w-[180px]"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={activeWorkspace ? `Workspace: ${activeWorkspace.name}` : 'Select workspace'}
        >
          <span className="truncate">
            {activeWorkspace ? activeWorkspace.name : 'Select workspace'}
          </span>
          <ChevronDown
            className={`w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <div
            className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
            role="listbox"
            aria-label="Workspaces"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search workspaces..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setFocusedIndex(-1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Search workspaces"
                />
              </div>
            </div>

            {/* Workspace List */}
            <div className="max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-6 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading...
                </div>
              ) : error ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ) : filteredWorkspaces.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {searchQuery ? 'No workspaces found' : 'No workspaces yet'}
                </div>
              ) : (
                <ul ref={listRef} className="py-1">
                  {filteredWorkspaces.map((workspace, index) => {
                    const isActive = activeWorkspace?.id === workspace.id;
                    const isFocused = focusedIndex === index;

                    return (
                      <li key={workspace.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onClick={() => handleSelectWorkspace(workspace)}
                          onMouseEnter={() => setFocusedIndex(index)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
                            isFocused
                              ? 'bg-gray-100 dark:bg-gray-800'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          } ${
                            isActive
                              ? 'text-blue-600 dark:text-blue-400 font-medium'
                              : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          <span className="truncate">{workspace.name}</span>
                          {isActive && (
                            <Check className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* Actions */}
            <div className="py-1">
              {/* Create Workspace */}
              <button
                type="button"
                role="menuitem"
                onClick={() => setIsCreateModalOpen(true)}
                onMouseEnter={() => setFocusedIndex(filteredWorkspaces.length)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  focusedIndex === filteredWorkspaces.length
                    ? 'bg-gray-100 dark:bg-gray-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                } text-gray-700 dark:text-gray-300`}
              >
                <Plus className="w-4 h-4" />
                <span>Create workspace</span>
              </button>

              {/* Manage Workspaces */}
              <Link
                href="/pilot/workspaces"
                role="menuitem"
                onClick={closeDropdown}
                onMouseEnter={() => setFocusedIndex(filteredWorkspaces.length + 1)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  focusedIndex === filteredWorkspaces.length + 1
                    ? 'bg-gray-100 dark:bg-gray-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                } text-gray-700 dark:text-gray-300`}
              >
                <Settings className="w-4 h-4" />
                <span>Manage workspaces</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleWorkspaceCreated}
      />
    </>
  );
}
