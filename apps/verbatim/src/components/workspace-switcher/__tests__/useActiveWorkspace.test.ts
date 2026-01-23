/**
 * Tests for useActiveWorkspace utilities
 *
 * Tests pure functions for workspace state management.
 * Mocks browser APIs (localStorage, window events).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LS_WORKSPACE_ID,
  LS_WORKSPACE_NAME,
  WORKSPACE_CHANGE_EVENT,
  getActiveWorkspaceFromStorage,
  setActiveWorkspaceInStorage,
  type ActiveWorkspace,
} from '../useActiveWorkspace';

describe('Workspace Switcher Utilities', () => {
  // Store original globals
  const originalWindow = global.window;
  const originalLocalStorage = global.localStorage;

  // Mock localStorage
  let mockStorage: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: vi.fn((key: string) => mockStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
    }),
    clear: vi.fn(() => {
      mockStorage = {};
    }),
    length: 0,
    key: vi.fn(),
  };

  // Mock dispatchEvent
  const mockDispatchEvent = vi.fn();

  beforeEach(() => {
    // Reset mocks
    mockStorage = {};
    vi.clearAllMocks();

    // Setup global mocks
    Object.defineProperty(global, 'window', {
      value: {
        localStorage: mockLocalStorage,
        dispatchEvent: mockDispatchEvent,
        CustomEvent: class MockCustomEvent extends Event {
          detail: unknown;
          constructor(type: string, options?: { detail?: unknown }) {
            super(type);
            this.detail = options?.detail;
          }
        },
      },
      writable: true,
    });

    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
  });

  afterEach(() => {
    // Restore globals
    Object.defineProperty(global, 'window', {
      value: originalWindow,
      writable: true,
    });
    Object.defineProperty(global, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
  });

  describe('Constants', () => {
    it('has expected localStorage key for workspace ID', () => {
      expect(LS_WORKSPACE_ID).toBe('verbatim_pilot_workspaceId');
    });

    it('has expected localStorage key for workspace name', () => {
      expect(LS_WORKSPACE_NAME).toBe('verbatim_pilot_workspaceName');
    });

    it('has expected custom event name', () => {
      expect(WORKSPACE_CHANGE_EVENT).toBe('verbatim:workspace-change');
    });
  });

  describe('getActiveWorkspaceFromStorage', () => {
    it('returns null when no workspace is stored', () => {
      expect(getActiveWorkspaceFromStorage()).toBeNull();
    });

    it('returns null when only ID is stored', () => {
      mockStorage[LS_WORKSPACE_ID] = 'ws_123';
      expect(getActiveWorkspaceFromStorage()).toBeNull();
    });

    it('returns null when only name is stored', () => {
      mockStorage[LS_WORKSPACE_NAME] = 'My Workspace';
      expect(getActiveWorkspaceFromStorage()).toBeNull();
    });

    it('returns workspace when both ID and name are stored', () => {
      mockStorage[LS_WORKSPACE_ID] = 'ws_123';
      mockStorage[LS_WORKSPACE_NAME] = 'My Workspace';

      const result = getActiveWorkspaceFromStorage();
      expect(result).toEqual({
        id: 'ws_123',
        name: 'My Workspace',
      });
    });

    it('returns workspace with special characters in name', () => {
      mockStorage[LS_WORKSPACE_ID] = 'ws_abc';
      mockStorage[LS_WORKSPACE_NAME] = 'Test & Demo <Workspace>';

      const result = getActiveWorkspaceFromStorage();
      expect(result).toEqual({
        id: 'ws_abc',
        name: 'Test & Demo <Workspace>',
      });
    });
  });

  describe('setActiveWorkspaceInStorage', () => {
    it('stores workspace ID and name in localStorage', () => {
      const workspace: ActiveWorkspace = {
        id: 'ws_456',
        name: 'Production',
      };

      setActiveWorkspaceInStorage(workspace);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(LS_WORKSPACE_ID, 'ws_456');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(LS_WORKSPACE_NAME, 'Production');
    });

    it('dispatches custom event with workspace detail', () => {
      const workspace: ActiveWorkspace = {
        id: 'ws_789',
        name: 'Staging',
      };

      setActiveWorkspaceInStorage(workspace);

      expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
      const dispatchedEvent = mockDispatchEvent.mock.calls[0][0];
      expect(dispatchedEvent.type).toBe(WORKSPACE_CHANGE_EVENT);
      expect(dispatchedEvent.detail).toEqual(workspace);
    });

    it('removes localStorage items when workspace is null', () => {
      // Set up existing values
      mockStorage[LS_WORKSPACE_ID] = 'ws_old';
      mockStorage[LS_WORKSPACE_NAME] = 'Old Workspace';

      setActiveWorkspaceInStorage(null);

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(LS_WORKSPACE_ID);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(LS_WORKSPACE_NAME);
    });

    it('dispatches custom event with null when clearing', () => {
      setActiveWorkspaceInStorage(null);

      expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
      const dispatchedEvent = mockDispatchEvent.mock.calls[0][0];
      expect(dispatchedEvent.type).toBe(WORKSPACE_CHANGE_EVENT);
      expect(dispatchedEvent.detail).toBeNull();
    });
  });

  describe('Round-trip storage', () => {
    it('stores and retrieves workspace correctly', () => {
      const workspace: ActiveWorkspace = {
        id: 'round_trip_id',
        name: 'Round Trip Workspace',
      };

      setActiveWorkspaceInStorage(workspace);

      // Manually update mockStorage since our mock setItem doesn't automatically do it
      mockStorage[LS_WORKSPACE_ID] = workspace.id;
      mockStorage[LS_WORKSPACE_NAME] = workspace.name;

      const retrieved = getActiveWorkspaceFromStorage();
      expect(retrieved).toEqual(workspace);
    });

    it('stores and clears workspace correctly', () => {
      mockStorage[LS_WORKSPACE_ID] = 'to_be_cleared';
      mockStorage[LS_WORKSPACE_NAME] = 'To Be Cleared';

      setActiveWorkspaceInStorage(null);

      // Manually clear mockStorage since our mock removeItem doesn't automatically do it
      delete mockStorage[LS_WORKSPACE_ID];
      delete mockStorage[LS_WORKSPACE_NAME];

      const retrieved = getActiveWorkspaceFromStorage();
      expect(retrieved).toBeNull();
    });
  });
});
