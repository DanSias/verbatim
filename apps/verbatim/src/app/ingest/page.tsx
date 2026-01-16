/**
 * Ingestion Page
 *
 * Purpose: Upload docs and KB batches.
 * See ARCHITECTURE.md Section 13.1.
 */
export default function IngestPage() {
  return (
    <main>
      <h1>Ingestion</h1>
      <p>Upload documentation batches for processing.</p>
      {/* TODO: Implement batch upload UI */}
      <section>
        <h2>Docs Corpus</h2>
        <p>Upload Next.js MDX pages (**/page.mdx)</p>
        {/* Placeholder for docs upload form */}
      </section>
      <section>
        <h2>KB Corpus</h2>
        <p>Upload Freshdesk Markdown exports (*.md)</p>
        {/* Placeholder for KB upload form */}
      </section>
    </main>
  );
}
