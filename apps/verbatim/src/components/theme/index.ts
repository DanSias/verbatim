/**
 * Theme Components
 *
 * Dark mode support for Verbatim UI.
 *
 * Usage:
 *   import { ThemeToggle, useTheme } from '@/components/theme';
 *
 * localStorage key: 'verbatim_theme'
 * Values: 'light' | 'dark'
 *
 * Behavior:
 * - Defaults to system preference if no localStorage value
 * - Persists user choice to localStorage when explicitly set
 * - Listens for system preference changes when no explicit choice
 */

export { ThemeToggle } from './ThemeToggle';
export { useTheme, getSystemTheme, getStoredTheme, applyTheme } from './useTheme';
export { THEME_STORAGE_KEY, type Theme } from './constants';
