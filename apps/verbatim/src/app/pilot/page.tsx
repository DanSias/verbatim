'use client';

/**
 * Pilot Landing Page - Smart Redirect
 *
 * Automatically routes users to the most appropriate page based on workspace state:
 * - No active workspace → /pilot/workspaces
 * - Active workspace with no content → /pilot/ingest
 * - Active workspace with content → /pilot/sources
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveWorkspace } from '@/components/workspace-switcher';
import { Loader2 } from 'lucide-react';

interface WorkspaceStats {
  workspaceId: string;
  documentsCount: number;
  chunksCount: number;
}

export default function PilotPage() {
  const router = useRouter();
  const { activeWorkspace, isLoaded } = useActiveWorkspace();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // Wait for workspace to load from localStorage
    if (!isLoaded) return;

    // Start redirecting process
    setIsRedirecting(true);

    // Case 1: No active workspace → send to workspaces page
    if (!activeWorkspace) {
      router.push('/pilot/workspaces');
      return;
    }

    // Case 2: Active workspace exists → check if it has content
    const checkWorkspaceContent = async () => {
      try {
        const response = await fetch(`/api/workspaces/${activeWorkspace.id}/stats`, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          // If stats call fails, default to sources page (don't strand user)
          console.warn('Failed to fetch workspace stats, defaulting to sources');
          router.push('/pilot/sources');
          return;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          console.warn('Non-JSON response from stats API, defaulting to sources');
          router.push('/pilot/sources');
          return;
        }

        const stats: WorkspaceStats = await response.json();

        // Case 2a: Workspace has no documents/chunks → send to ingest
        if (stats.documentsCount === 0 || stats.chunksCount === 0) {
          router.push('/pilot/ingest');
        } else {
          // Case 2b: Workspace has content → send to sources
          router.push('/pilot/sources');
        }
      } catch (error) {
        // On error, default to sources page (don't strand user)
        console.error('Error checking workspace content:', error);
        router.push('/pilot/sources');
      }
    };

    checkWorkspaceContent();
  }, [activeWorkspace, isLoaded, router]);

  // Show loading state while redirecting
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {!isLoaded ? 'Loading workspace...' : isRedirecting ? 'Redirecting...' : 'Loading...'}
        </p>
      </div>
    </div>
  );
}
