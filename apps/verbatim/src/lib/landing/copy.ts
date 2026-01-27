/**
 * Landing Page Copy
 *
 * Centralized copy strings for the landing page.
 * Edit these to update messaging without touching component code.
 */

export const landingCopy = {
  // Hero section
  hero: {
    headline: 'Answers from your docs, backed by citations',
    subhead:
      'Verbatim ingests your documentation and knowledge base, retrieves the most relevant context, and generates grounded answers with direct links back to the source.',
    ctaPrimary: 'Open Pilot',
    ctaSecondary: 'View sources',
  },

  // How it works section
  howItWorks: {
    title: 'How it works',
    steps: [
      {
        number: 1,
        title: 'Ingest your documentation',
        description:
          'Upload product docs and internal knowledge. Verbatim splits content into structured sections and indexes it for precise retrieval.',
      },
      {
        number: 2,
        title: 'Retrieve relevant context',
        description:
          'Questions are matched against your content using keyword and phrase-aware scoring to surface the most relevant sections.',
      },
      {
        number: 3,
        title: 'Generate cited answers',
        description:
          'Retrieved context is sent to an LLM to produce a clear answer, with numbered citations linking directly to the original source.',
      },
    ],
  },

  // What you get section
  whatYouGet: {
    title: 'What you get',
    features: [
      {
        title: 'Workspaces',
        description:
          'Organize documentation by project or team. Each workspace scopes ingestion, retrieval, and answers.',
        icon: 'Layers',
      },
      {
        title: 'Sources & chunks',
        description:
          'Browse ingested documents and the exact sections used for retrieval, including metadata and anchors.',
        icon: 'FileText',
      },
      {
        title: 'Deterministic retrieval',
        description:
          'Understand why content was selected. Review ranked results instead of relying on opaque embeddings alone.',
        icon: 'Search',
      },
      {
        title: 'Verifiable citations',
        description:
          'Every answer includes links back to the original document or knowledge base entry for audit and trust.',
        icon: 'Link',
      },
      {
        title: 'Embeddable widget',
        description:
          'Expose your knowledge through a chat widget embedded directly into your docs or site.',
        icon: 'Bot',
      },
      {
        title: 'Usage visibility',
        description: 'Track retrieval behavior, latency, and model usage across workspaces.',
        icon: 'BarChart3',
      },
    ],
  },

  // Widget callout section
  widgetCallout: {
    title: 'Bring answers to your docs',
    description:
      'Embed a lightweight chat widget that answers questions using your documentation. Users stay on your site and get responses they can verify.',
    ctaText: 'View widget demo',
    ctaHref: '/pilot/widget',
  },

  // Security section
  security: {
    title: 'Authentication & access control',
    description:
      'Authentication is handled via Google OAuth. Access can be restricted using simple allowlists, making Verbatim easy to deploy internally or within a team.',
  },

  // Footer
  footer: {
    tagline: 'Documentation assistant with verifiable answers',
    pilotLinks: [
      { label: 'Workspaces', href: '/pilot/workspaces' },
      { label: 'Ingest', href: '/pilot/ingest' },
      { label: 'Sources', href: '/pilot/sources' },
      { label: 'Ask', href: '/pilot/ask' },
      { label: 'Answer', href: '/pilot/answer' },
      { label: 'Widget demo', href: '/pilot/widget' },
      { label: 'Widget install', href: '/pilot/widget/install' },
      { label: 'Usage', href: '/pilot/usage' },
    ],
  },
};
