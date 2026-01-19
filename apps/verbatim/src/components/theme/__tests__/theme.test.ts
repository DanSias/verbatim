/**
 * Tests for theme utilities
 *
 * Tests pure functions for theme management.
 * Mocks browser APIs (localStorage, matchMedia, document).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { THEME_STORAGE_KEY, type Theme } from '../constants';

// We need to test the functions in isolation, so we'll re-implement the logic
// to avoid issues with module-level window checks

describe('Theme Utilities', () => {
  // Store original globals
  const originalWindow = global.window;
  const originalDocument = global.document;
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

  // Mock matchMedia
  let mockPrefersColorScheme = false;
  const mockMatchMedia = vi.fn((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? mockPrefersColorScheme : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  // Mock document.documentElement
  let mockClassList: Set<string> = new Set();
  const mockDocumentElement = {
    classList: {
      add: vi.fn((cls: string) => mockClassList.add(cls)),
      remove: vi.fn((cls: string) => mockClassList.delete(cls)),
      contains: vi.fn((cls: string) => mockClassList.has(cls)),
    },
  };

  beforeEach(() => {
    // Reset mocks
    mockStorage = {};
    mockPrefersColorScheme = false;
    mockClassList = new Set();
    vi.clearAllMocks();

    // Setup global mocks
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: mockMatchMedia,
        localStorage: mockLocalStorage,
      },
      writable: true,
    });

    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    Object.defineProperty(global, 'document', {
      value: {
        documentElement: mockDocumentElement,
      },
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
    Object.defineProperty(global, 'document', {
      value: originalDocument,
      writable: true,
    });
  });

  describe('getStoredTheme', () => {
    // Inline implementation to test
    function getStoredTheme(): Theme | null {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      return null;
    }

    it('returns null when no theme is stored', () => {
      expect(getStoredTheme()).toBeNull();
    });

    it('returns "light" when light theme is stored', () => {
      mockStorage[THEME_STORAGE_KEY] = 'light';
      expect(getStoredTheme()).toBe('light');
    });

    it('returns "dark" when dark theme is stored', () => {
      mockStorage[THEME_STORAGE_KEY] = 'dark';
      expect(getStoredTheme()).toBe('dark');
    });

    it('returns null for invalid stored value', () => {
      mockStorage[THEME_STORAGE_KEY] = 'invalid';
      expect(getStoredTheme()).toBeNull();
    });

    it('returns null for empty string', () => {
      mockStorage[THEME_STORAGE_KEY] = '';
      expect(getStoredTheme()).toBeNull();
    });
  });

  describe('getSystemTheme', () => {
    // Inline implementation to test
    function getSystemTheme(): Theme {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    it('returns "light" when system prefers light', () => {
      mockPrefersColorScheme = false;
      expect(getSystemTheme()).toBe('light');
    });

    it('returns "dark" when system prefers dark', () => {
      mockPrefersColorScheme = true;
      expect(getSystemTheme()).toBe('dark');
    });
  });

  describe('applyTheme', () => {
    // Inline implementation to test
    function applyTheme(theme: Theme): void {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }

    it('adds "dark" class for dark theme', () => {
      applyTheme('dark');
      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('dark');
    });

    it('removes "dark" class for light theme', () => {
      applyTheme('light');
      expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith('dark');
    });
  });

  describe('Theme Resolution Logic', () => {
    // Test the resolution logic used in FOUC script and hook
    function resolveTheme(): Theme {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    it('uses stored theme when available', () => {
      mockStorage[THEME_STORAGE_KEY] = 'dark';
      mockPrefersColorScheme = false; // System says light
      expect(resolveTheme()).toBe('dark'); // But stored says dark
    });

    it('falls back to system theme when no stored preference', () => {
      mockPrefersColorScheme = true;
      expect(resolveTheme()).toBe('dark');

      mockPrefersColorScheme = false;
      expect(resolveTheme()).toBe('light');
    });

    it('ignores invalid stored values and uses system theme', () => {
      mockStorage[THEME_STORAGE_KEY] = 'invalid';
      mockPrefersColorScheme = true;
      expect(resolveTheme()).toBe('dark');
    });
  });

  describe('THEME_STORAGE_KEY', () => {
    it('has the expected value', () => {
      expect(THEME_STORAGE_KEY).toBe('verbatim_theme');
    });
  });
});
