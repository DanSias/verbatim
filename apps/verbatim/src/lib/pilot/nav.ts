import {
  Layers,
  UploadCloud,
  FileText,
  Search,
  MessageSquareText,
  Bot,
  Plug,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';

export interface PilotNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** If true, only match exact pathname (not prefix) */
  exactMatch?: boolean;
}

export interface PilotNavSection {
  label: string;
  sectionDescription?: string;
  items: PilotNavItem[];
}

export const PILOT_NAV_SECTIONS: PilotNavSection[] = [
  {
    label: 'Core',
    sectionDescription: 'Manage workspaces and ingest documentation.',
    items: [
      {
        href: '/pilot/workspaces',
        label: 'Workspaces',
        description: 'Create, organize, and manage workspace contexts.',
        icon: Layers,
      },
      {
        href: '/pilot/ingest',
        label: 'Ingest',
        description: 'Upload documents and knowledge base files.',
        icon: UploadCloud,
      },
      {
        href: '/pilot/sources',
        label: 'Sources',
        description: 'Browse documents, chunks, and metadata.',
        icon: FileText,
      },
    ],
  },
  {
    label: 'Q&A',
    sectionDescription: 'Test retrieval and answer generation.',
    items: [
      {
        href: '/pilot/ask',
        label: 'Ask',
        description: 'Query retrieval and review cited answers.',
        icon: Search,
      },
      {
        href: '/pilot/answer',
        label: 'Answer',
        description: 'Inspect generated responses and traces.',
        icon: MessageSquareText,
      },
    ],
  },
  {
    label: 'Widget',
    sectionDescription: 'Preview and integrate the docs widget.',
    items: [
      {
        href: '/pilot/widget',
        label: 'Widget Demo',
        description: 'Preview the chat widget experience.',
        icon: Bot,
        exactMatch: true,
      },
      {
        href: '/pilot/widget/install',
        label: 'Widget Install',
        description: 'Get embed instructions and configuration.',
        icon: Plug,
      },
    ],
  },
  {
    label: 'Analytics',
    sectionDescription: 'Monitor usage, latency, and cost.',
    items: [
      {
        href: '/pilot/usage',
        label: 'Usage',
        description: 'Track usage metrics and performance.',
        icon: BarChart3,
      },
    ],
  },
];
