'use client';

/**
 * Theme Hook
 *
 * Manages theme state with localStorage persistence and system preference detection.
 *
 * Behavior:
 * - On initial load, checks localStorage for saved preference
 * - If no saved preference, uses system preference (prefers-color-scheme)
 * - Listens for system theme changes when no explicit preference is set
 * - Persists user choice to localStorage when explicitly set
 *
 * localStorage key: 'verbatim_theme' (values: 'light' | 'dark')
 */

import { useState, useEffect, useCallback } from 'react';
import { THEME_STORAGE_KEY, type Theme } from './constants';

/** Return type for useTheme hook */
export interface UseThemeReturn {
  /** Current resolved theme */
  theme: Theme;
  /** Whether the theme has been initialized (to prevent FOUC) */
  isInitialized: boolean;
  /** Set theme explicitly (persists to localStorage) */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark */
  toggleTheme: () => void;
}

/**
 * Get the system's preferred color scheme.
 */
export function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get the stored theme from localStorage.
 * Returns null if no preference is stored.
 */
export function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return null;
}

/**
 * Apply theme to the document by adding/removing 'dark' class on <html>.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Hook for managing theme state.
 */
export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>('light');
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasExplicitPreference, setHasExplicitPreference] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const stored = getStoredTheme();
    if (stored) {
      setThemeState(stored);
      setHasExplicitPreference(true);
      applyTheme(stored);
    } else {
      const system = getSystemTheme();
      setThemeState(system);
      applyTheme(system);
    }
    setIsInitialized(true);
  }, []);

  // Listen for system theme changes when no explicit preference
  useEffect(() => {
    if (hasExplicitPreference) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme: Theme = e.matches ? 'dark' : 'light';
      setThemeState(newTheme);
      applyTheme(newTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [hasExplicitPreference]);

  // Set theme explicitly (persists to localStorage)
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    setHasExplicitPreference(true);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyTheme(newTheme);
  }, []);

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [theme, setTheme]);

  return {
    theme,
    isInitialized,
    setTheme,
    toggleTheme,
  };
}
