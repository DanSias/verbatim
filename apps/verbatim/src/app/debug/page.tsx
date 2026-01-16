/**
 * Debug Page
 *
 * Purpose: Test questions and inspect retrieval traces.
 * See ARCHITECTURE.md Section 13.3.
 */
export default function DebugPage() {
  return (
    <main>
      <h1>Debug</h1>
      <p>Test questions and inspect retrieval behavior.</p>
      {/* TODO: Implement debug UI */}
      <section>
        <h2>Ask a Question</h2>
        {/* Placeholder for question input */}
      </section>
      <section>
        <h2>Retrieval Trace</h2>
        {/* Placeholder for trace display */}
        <p>Shows: retrieved documents, chunks, citations, suggested routes</p>
      </section>
    </main>
  );
}
