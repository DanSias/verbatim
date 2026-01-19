'use client';

/**
 * Theme Toggle Component
 *
 * Button that toggles between light and dark themes.
 * Shows sun icon in dark mode, moon icon in light mode.
 */

import { Sun, Moon } from 'lucide-react';
import { useTheme } from './useTheme';

interface ThemeToggleProps {
  /** Optional additional CSS classes */
  className?: string;
  /** Show label text alongside icon */
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, isInitialized, toggleTheme } = useTheme();

  // Don't render until initialized to prevent hydration mismatch
  if (!isInitialized) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-md ${className}`}
        aria-hidden="true"
      >
        <div className="w-5 h-5" />
        {showLabel && <span className="text-sm">Theme</span>}
      </div>
    );
  }

  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? 'Light mode' : 'Dark mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
        transition-colors duration-150
        text-gray-700 dark:text-gray-300
        hover:bg-gray-100 dark:hover:bg-gray-800
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
        dark:focus-visible:ring-offset-gray-900
        ${className}
      `}
      aria-label={label}
      title={label}
    >
      <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      {showLabel && <span>{label}</span>}
    </button>
  );
}
