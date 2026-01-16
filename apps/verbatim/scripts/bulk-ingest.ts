/**
 * Bulk Ingestion Script
 *
 * Usage (per OPERATIONS.md Section 3):
 *   npx tsx scripts/bulk-ingest.ts <workspace-id> <content-root> --corpus docs
 *   npx tsx scripts/bulk-ingest.ts <workspace-id> <content-root> --corpus kb
 *
 * TODO: Implement ingestion logic
 * - Recursively scan folders
 * - For docs: only process /page.mdx files
 * - For kb: process all *.md files
 * - Upload batches to /api/ingest/batch
 */

const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('Usage: npx tsx scripts/bulk-ingest.ts <workspace-id> <content-root> --corpus <docs|kb>');
  process.exit(1);
}

const workspaceId = args[0];
const contentRoot = args[1];
const corpusIndex = args.indexOf('--corpus');
const corpus = corpusIndex !== -1 ? args[corpusIndex + 1] : null;

if (!corpus || (corpus !== 'docs' && corpus !== 'kb')) {
  console.error('Error: --corpus must be "docs" or "kb"');
  process.exit(1);
}

console.log(`Bulk ingest placeholder`);
console.log(`  Workspace: ${workspaceId}`);
console.log(`  Content root: ${contentRoot}`);
console.log(`  Corpus: ${corpus}`);
console.log(`\nNot yet implemented.`);
