#!/usr/bin/env tsx
/**
 * Bulk Ingestion Script
 *
 * Usage (per OPERATIONS.md Section 3):
 *   npx tsx scripts/bulk-ingest.ts <workspace-id> <content-root> --corpus docs
 *   npx tsx scripts/bulk-ingest.ts <workspace-id> <content-root> --corpus kb
 *
 * Or via npm script:
 *   npm run ingest -- <workspace-id> <content-root> --corpus docs
 *
 * Options:
 *   --batch-size <n>  Number of files per batch (default: 10)
 *   --base-url <url>  API base URL (default: http://localhost:3000)
 *   --dry-run         Show what would be uploaded without uploading
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_BASE_URL = 'http://localhost:3000';

interface Config {
  workspaceId: string;
  contentRoot: string;
  corpus: 'docs' | 'kb';
  batchSize: number;
  baseUrl: string;
  dryRun: boolean;
}

interface FileInfo {
  absolutePath: string;
  relativePath: string;
}

interface IngestResult {
  filename: string;
  status: 'ok' | 'skipped' | 'error';
  canonicalId?: string;
  route?: string;
  error?: string;
}

interface BatchResponse {
  results: IngestResult[];
  totalProcessed: number;
  totalSkipped: number;
  totalErrors: number;
}

/**
 * Parse command line arguments.
 */
function parseArgs(): Config {
  const args = process.argv.slice(2);

  if (args.length < 3 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Verbatim Bulk Ingestion Script

Usage:
  npx tsx scripts/bulk-ingest.ts <workspace-id> <content-root> --corpus <docs|kb>

Arguments:
  workspace-id   The workspace ID to ingest into
  content-root   Path to the content directory

Options:
  --corpus <type>     Corpus type: "docs" or "kb" (required)
  --batch-size <n>    Files per batch (default: ${DEFAULT_BATCH_SIZE})
  --base-url <url>    API URL (default: ${DEFAULT_BASE_URL})
  --dry-run           Preview without uploading

Examples:
  npx tsx scripts/bulk-ingest.ts ws_123 ./docs --corpus docs
  npx tsx scripts/bulk-ingest.ts ws_123 ./kb-export --corpus kb --batch-size 5
`);
    process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
  }

  const workspaceId = args[0];
  const contentRoot = args[1];

  // Parse options
  const corpusIndex = args.indexOf('--corpus');
  const corpus = corpusIndex !== -1 ? args[corpusIndex + 1] : null;

  if (!corpus || (corpus !== 'docs' && corpus !== 'kb')) {
    console.error('Error: --corpus must be "docs" or "kb"');
    process.exit(1);
  }

  const batchSizeIndex = args.indexOf('--batch-size');
  const batchSize = batchSizeIndex !== -1
    ? parseInt(args[batchSizeIndex + 1], 10)
    : DEFAULT_BATCH_SIZE;

  const baseUrlIndex = args.indexOf('--base-url');
  const baseUrl = baseUrlIndex !== -1
    ? args[baseUrlIndex + 1]
    : DEFAULT_BASE_URL;

  const dryRun = args.includes('--dry-run');

  return {
    workspaceId,
    contentRoot: path.resolve(contentRoot),
    corpus: corpus as 'docs' | 'kb',
    batchSize,
    baseUrl,
    dryRun,
  };
}

/**
 * Recursively find all files matching the corpus pattern.
 *
 * For docs: only **/page.mdx files
 * For kb: all *.md files
 */
function findFiles(config: Config): FileInfo[] {
  const files: FileInfo[] = [];
  const pattern = config.corpus === 'docs' ? /page\.mdx$/i : /\.md$/i;

  function scan(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scan(fullPath);
        }
      } else if (entry.isFile() && pattern.test(entry.name)) {
        // For docs, only include page.mdx files
        if (config.corpus === 'docs' && entry.name.toLowerCase() !== 'page.mdx') {
          continue;
        }

        const relativePath = path.relative(config.contentRoot, fullPath);
        files.push({
          absolutePath: fullPath,
          relativePath: relativePath.replace(/\\/g, '/'), // Normalize to forward slashes
        });
      }
    }
  }

  scan(config.contentRoot);
  return files;
}

/**
 * Split files into batches.
 */
function batchFiles(files: FileInfo[], batchSize: number): FileInfo[][] {
  const batches: FileInfo[][] = [];
  for (let i = 0; i < files.length; i += batchSize) {
    batches.push(files.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Upload a batch of files to the ingestion endpoint.
 */
async function uploadBatch(
  config: Config,
  batch: FileInfo[],
  batchNumber: number,
  totalBatches: number
): Promise<BatchResponse> {
  const formData = new FormData();
  formData.append('workspaceId', config.workspaceId);
  formData.append('corpus', config.corpus);

  for (const file of batch) {
    const content = fs.readFileSync(file.absolutePath, 'utf-8');
    // Use relative path as filename to preserve directory structure
    const blob = new Blob([content], { type: 'text/plain' });
    formData.append('files', blob, file.relativePath);
  }

  const url = `${config.baseUrl}/api/ingest/batch`;
  console.log(`\n[Batch ${batchNumber}/${totalBatches}] Uploading ${batch.length} files...`);

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return response.json() as Promise<BatchResponse>;
}

/**
 * Print results for a batch.
 */
function printBatchResults(response: BatchResponse) {
  for (const result of response.results) {
    const icon = result.status === 'ok' ? '✓' : result.status === 'skipped' ? '○' : '✗';
    const route = result.route ? ` → ${result.route}` : '';
    const error = result.error ? ` (${result.error})` : '';
    console.log(`  ${icon} ${result.filename}${route}${error}`);
  }
}

/**
 * Main entry point.
 */
async function main() {
  const config = parseArgs();

  console.log('Verbatim Bulk Ingestion');
  console.log('=======================');
  console.log(`Workspace:    ${config.workspaceId}`);
  console.log(`Content root: ${config.contentRoot}`);
  console.log(`Corpus:       ${config.corpus}`);
  console.log(`Batch size:   ${config.batchSize}`);
  console.log(`API URL:      ${config.baseUrl}`);
  console.log(`Dry run:      ${config.dryRun}`);

  // Verify content root exists
  if (!fs.existsSync(config.contentRoot)) {
    console.error(`\nError: Content root does not exist: ${config.contentRoot}`);
    process.exit(1);
  }

  // Find files
  console.log('\nScanning for files...');
  const files = findFiles(config);

  if (files.length === 0) {
    console.log('\nNo files found matching the pattern.');
    console.log(config.corpus === 'docs'
      ? 'Expected: **/page.mdx files'
      : 'Expected: **/*.md files');
    process.exit(0);
  }

  console.log(`Found ${files.length} file(s)`);

  // Show files in dry run mode
  if (config.dryRun) {
    console.log('\nFiles to be uploaded (dry run):');
    for (const file of files) {
      console.log(`  ${file.relativePath}`);
    }
    console.log('\nRun without --dry-run to upload.');
    process.exit(0);
  }

  // Split into batches
  const batches = batchFiles(files, config.batchSize);
  console.log(`\nProcessing ${batches.length} batch(es)...`);

  // Upload batches
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (let i = 0; i < batches.length; i++) {
    try {
      const response = await uploadBatch(config, batches[i], i + 1, batches.length);
      printBatchResults(response);
      totalProcessed += response.totalProcessed;
      totalSkipped += response.totalSkipped;
      totalErrors += response.totalErrors;
    } catch (error) {
      console.error(`\nBatch ${i + 1} failed:`, error);
      totalErrors += batches[i].length;
    }
  }

  // Summary
  console.log('\n=======================');
  console.log('Summary:');
  console.log(`  Processed: ${totalProcessed}`);
  console.log(`  Skipped:   ${totalSkipped}`);
  console.log(`  Errors:    ${totalErrors}`);
  console.log(`  Total:     ${files.length}`);

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
