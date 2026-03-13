export interface ManifestEntry {
  sourcePath: string;
  publicUrl: string;
  outputPath: string;
  sourceSha: string;
  status: string;
  isPublic: boolean;
  notes: string[];
}

export interface DocHeading {
  depth: number;
  text: string;
  id: string;
}

export interface DocRecord {
  title: string;
  description: string;
  pubDate?: string;
  publicUrl: string;
  sourcePath: string;
  outputPath: string;
  outputPathAbs: string;
  slugSegments: string[];
  section: string | null;
  body: string;
  excerpt: string;
  headings: DocHeading[];
}

export interface SidebarLinkItem {
  kind: "link";
  title: string;
  href: string;
  active: boolean;
  children?: SidebarItem[];
}

export interface SidebarHeadingItem {
  kind: "heading";
  title: string;
}

export interface SidebarDividerItem {
  kind: "divider";
}

export type SidebarItem =
  | SidebarLinkItem
  | SidebarHeadingItem
  | SidebarDividerItem;

export interface SearchRecord {
  id: string;
  title: string;
  description?: string;
  excerpt: string;
  url: string;
  section?: string;
  breadcrumb: string[];
  anchor?: string;
  keywords: string[];
}
