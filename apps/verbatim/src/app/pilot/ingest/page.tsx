'use client';

/**
 * Pilot Ingest Page
 *
 * Upload UI for ingesting docs (MDX) or KB (Markdown) files.
 * Supports both multi-file and folder upload with relative path preservation.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

/** LocalStorage keys */
const LS_WORKSPACE_ID = 'verbatim_pilot_workspaceId';
const LS_WORKSPACE_NAME = 'verbatim_pilot_workspaceName';
const LS_CORPUS = 'verbatim_pilot_ingestCorpus';

/** Corpus type */
type Corpus = 'docs' | 'kb';

/** File with relative path info */
interface FileWithPath {
  file: File;
  relativePath: string;
}

/** Ingest result from API */
interface IngestResult {
  filename: string;
  status: 'ok' | 'skipped' | 'error';
  canonicalId?: string;
  route?: string;
  error?: string;
}

/** Ingest response from API */
interface IngestResponse {
  results: IngestResult[];
  totalProcessed: number;
  totalSkipped: number;
  totalErrors: number;
}

/** Max files to display in list */
const MAX_DISPLAY_FILES = 50;

export default function PilotIngestPage() {
  // Form state
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [corpus, setCorpus] = useState<Corpus>('docs');
  const [useFolderUpload, setUseFolderUpload] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileWithPath[]>([]);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<IngestResponse | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Load persisted values
  useEffect(() => {
    try {
      const savedWorkspaceId = localStorage.getItem(LS_WORKSPACE_ID);
      if (savedWorkspaceId) setWorkspaceId(savedWorkspaceId);

      const savedWorkspaceName = localStorage.getItem(LS_WORKSPACE_NAME);
      if (savedWorkspaceName) setWorkspaceName(savedWorkspaceName);

      const savedCorpus = localStorage.getItem(LS_CORPUS);
      if (savedCorpus === 'docs' || savedCorpus === 'kb') {
        setCorpus(savedCorpus);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Persist workspace ID
  useEffect(() => {
    try {
      if (workspaceId) {
        localStorage.setItem(LS_WORKSPACE_ID, workspaceId);
      }
    } catch {
      // Ignore
    }
  }, [workspaceId]);

  // Persist corpus
  useEffect(() => {
    try {
      localStorage.setItem(LS_CORPUS, corpus);
    } catch {
      // Ignore
    }
  }, [corpus]);

  // Handle file selection (multi-file mode)
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileList: FileWithPath[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // In multi-file mode, use the file name as the relative path
      fileList.push({
        file,
        relativePath: file.name,
      });
    }
    setSelectedFiles(fileList);
    setResponse(null);
    setError(null);
  }, []);

  // Handle folder selection (folder upload mode)
  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileList: FileWithPath[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Use webkitRelativePath for relative path preservation
      const relativePath =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      fileList.push({
        file,
        relativePath,
      });
    }
    setSelectedFiles(fileList);
    setResponse(null);
    setError(null);
  }, []);

  // Clear file selection
  const handleClearFiles = useCallback(() => {
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
    setResponse(null);
    setError(null);
  }, []);

  // Handle upload
  const handleUpload = useCallback(async () => {
    if (!workspaceId.trim()) {
      setError('Workspace ID is required');
      return;
    }
    if (selectedFiles.length === 0) {
      setError('No files selected');
      return;
    }

    setUploading(true);
    setError(null);
    setResponse(null);
    setUploadProgress('Preparing upload...');

    try {
      // Build FormData with files renamed to their relative paths
      const formData = new FormData();
      formData.append('workspaceId', workspaceId.trim());
      formData.append('corpus', corpus);

      // Append files with their relative paths as the filename
      for (const { file, relativePath } of selectedFiles) {
        // Create a new File object with the relative path as the name
        // This preserves the path for the server to derive routes/sourcePaths
        const renamedFile = new File([file], relativePath, { type: file.type });
        formData.append('files', renamedFile);
      }

      setUploadProgress(`Uploading ${selectedFiles.length} file(s)...`);

      const res = await fetch('/api/ingest/batch', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setResponse(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  }, [workspaceId, corpus, selectedFiles]);

  // Filter files for display
  const displayFiles = selectedFiles.slice(0, MAX_DISPLAY_FILES);
  const remainingCount = selectedFiles.length - MAX_DISPLAY_FILES;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ingest Documents</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Upload docs (MDX) or KB (Markdown) files to a workspace.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 space-y-6">
        {/* Workspace ID */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Workspace ID</label>
            <Link href="/pilot/workspaces" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
              Manage workspaces
            </Link>
          </div>
          {workspaceName && workspaceId && (
            <div className="mb-2 flex items-center gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Active:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{workspaceName}</span>
              <Link href="/pilot/workspaces" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                Change
              </Link>
            </div>
          )}
          <input
            type="text"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            placeholder="e.g., clx123abc..."
            className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-offset-gray-900"
            disabled={uploading}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {workspaceName
              ? 'Using active workspace. You can also enter a different ID manually.'
              : 'Workspace must already exist. Go to Workspaces to create one.'}
          </p>
        </div>

        {/* Corpus selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Corpus</label>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="corpus"
                value="docs"
                checked={corpus === 'docs'}
                onChange={() => setCorpus('docs')}
                disabled={uploading}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">docs</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="corpus"
                value="kb"
                checked={corpus === 'kb'}
                onChange={() => setCorpus('kb')}
                disabled={uploading}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">kb</span>
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {corpus === 'docs' ? (
              <>
                <strong>docs:</strong> Only{' '}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">page.mdx</code> files. Route derived from
                relative path.
              </>
            ) : (
              <>
                <strong>kb:</strong> All <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.md</code>{' '}
                files. Identity derived from relative path. No routes.
              </>
            )}
          </p>
        </div>

        {/* Upload mode toggle */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useFolderUpload}
              onChange={(e) => {
                setUseFolderUpload(e.target.checked);
                handleClearFiles();
              }}
              disabled={uploading}
              className="text-blue-600 focus:ring-blue-500 rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Folder upload (Chrome/Edge)</span>
          </label>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {useFolderUpload
              ? 'Select a folder to preserve relative paths for route/sourcePath derivation.'
              : 'Select individual files (paths will be flat).'}
          </p>
        </div>

        {/* File selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Files</label>

          {useFolderUpload ? (
            <input
              ref={folderInputRef}
              type="file"
              // @ts-expect-error webkitdirectory is not in standard types
              webkitdirectory="true"
              multiple
              onChange={handleFolderSelect}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50 disabled:opacity-50"
            />
          ) : (
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={corpus === 'docs' ? '.mdx' : '.md'}
              onChange={handleFileSelect}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50 disabled:opacity-50"
            />
          )}

          {/* Selected files list */}
          {selectedFiles.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedFiles.length} file(s) selected
                </span>
                <button
                  onClick={handleClearFiles}
                  disabled={uploading}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 p-2">
                <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
                  {displayFiles.map(({ relativePath }, i) => (
                    <li key={i} className="font-mono truncate">
                      {relativePath}
                    </li>
                  ))}
                  {remainingCount > 0 && <li className="text-gray-400 dark:text-gray-500">+{remainingCount} more</li>}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Upload button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          {uploadProgress && <span className="text-sm text-gray-600 dark:text-gray-400">{uploadProgress}</span>}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg p-4">
          <p className="text-sm text-red-700 dark:text-red-200">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Results display */}
      {response && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Results</h2>

          {/* Summary */}
          <div className="flex gap-4 text-sm">
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
              {response.totalProcessed} processed
            </span>
            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded">
              {response.totalSkipped} skipped
            </span>
            <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
              {response.totalErrors} errors
            </span>
          </div>

          {/* Results list */}
          <div className="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">File</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {response.results.map((result, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100 truncate max-w-xs">
                      {result.filename}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={result.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                      {result.status === 'ok' && result.canonicalId && (
                        <span className="font-mono">{result.canonicalId}</span>
                      )}
                      {result.status === 'ok' && result.route && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400">{result.route}</span>
                      )}
                      {result.error && <span className="text-red-600 dark:text-red-400">{result.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fixtures reminder */}
      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <strong>Tip:</strong> Test fixtures are in{' '}
          <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">/fixtures/docs</code> and{' '}
          <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">/fixtures/kb</code>. Use folder upload to
          ingest them with correct paths.
        </p>
      </div>
    </div>
  );
}

/** Status badge component */
function StatusBadge({ status }: { status: 'ok' | 'skipped' | 'error' }) {
  const styles = {
    ok: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    skipped: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    error: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>{status}</span>
  );
}
