/**
 * Not Authorized Page
 *
 * Shown when a user signs in successfully but is not on the allowlist.
 */

import { auth, signOut } from '@/auth';

export default async function NotAuthorizedPage() {
  const session = await auth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <svg
                className="w-8 h-8 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Access Not Authorized
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your account is not authorized to access this application.
            </p>
          </div>

          {session?.user?.email && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Signed in as:</span>
                <br />
                <span className="font-mono">{session.user.email}</span>
              </p>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Access to this application is controlled through an email allowlist.
              Please contact your administrator if you believe you should have access.
            </p>

            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <button
                type="submit"
                className="w-full px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
