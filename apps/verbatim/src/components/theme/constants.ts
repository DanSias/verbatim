/**
 * Theme Constants
 *
 * Shared constants for theme management.
 */

/** localStorage key for persisted theme preference */
export const THEME_STORAGE_KEY = 'verbatim_theme';

/** Available theme values */
export type Theme = 'light' | 'dark';

/** Default theme when no preference is set (falls back to system) */
export const DEFAULT_THEME: Theme = 'light';
