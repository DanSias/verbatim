'use client';

/**
 * Lightweight Tooltip Component
 *
 * Shows a tooltip on hover and focus for accessible UI hints.
 * No external dependencies, pure Tailwind CSS.
 */

import { useState } from 'react';

interface TooltipProps {
  /** The element that triggers the tooltip */
  children: React.ReactNode;
  /** The tooltip text content */
  label: string;
  /** Optional side preference (defaults to right for sidebar) */
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({ children, label, side = 'right' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={`
            absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700
            rounded shadow-lg whitespace-nowrap pointer-events-none
            ${positionClasses[side]}
          `}
        >
          {label}
        </div>
      )}
    </div>
  );
}
