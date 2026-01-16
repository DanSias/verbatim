/**
 * Verbatim Internal Web UI - Home
 *
 * Purpose: Landing page for internal operations.
 * See ARCHITECTURE.md Section 13 for Internal UI requirements.
 */
export default function HomePage() {
  return (
    <main>
      <h1>Verbatim</h1>
      <p>Internal operations console</p>
      <nav>
        <ul>
          <li>
            <a href="/ingest">Ingestion</a>
          </li>
          <li>
            <a href="/documents">Documents</a>
          </li>
          <li>
            <a href="/debug">Debug</a>
          </li>
        </ul>
      </nav>
    </main>
  );
}
