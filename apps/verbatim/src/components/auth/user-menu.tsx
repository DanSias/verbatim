/**
 * User Menu Component
 *
 * Displays signed-in user email and sign-out button.
 * Used in the Pilot UI sidebar footer.
 */

'use client';

import { useSession, signOut } from 'next-auth/react';

/**
 * Truncate email for display
 * Example: john.doe.long@company.com -> john.d...@company.com
 */
function truncateEmail(email: string, maxLength: number = 24): string {
  if (email.length <= maxLength) return email;

  const [localPart, domain] = email.split('@');
  const availableLength = maxLength - domain.length - 4; // -4 for "...@"

  if (availableLength < 3) {
    // If domain is too long, just truncate the whole thing
    return email.substring(0, maxLength - 3) + '...';
  }

  return localPart.substring(0, availableLength) + '...@' + domain;
}

export function UserMenu() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  const displayEmail = session.user.email
    ? truncateEmail(session.user.email)
    : 'Unknown user';

  return (
    <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-800">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Signed in as</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate font-mono">
            {displayEmail}
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex-shrink-0 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
