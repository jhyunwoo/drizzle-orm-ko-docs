import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import GithubSlugger from "github-slugger";

import type {
  DocHeading,
  DocRecord,
  ManifestEntry,
  SearchRecord,
  SidebarItem,
} from "@/lib/docs/types";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "translation", "manifest.json");
const DOCS_ROOT = path.join(ROOT, "src", "content", "docs-ko");

let manifestCache: ManifestEntry[] | null = null;
const docCache = new Map<string, Promise<DocRecord>>();

function normalizeUrl(url: string) {
  if (url === "/docs") return "/docs";
  return url.replace(/\/+$/, "");
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function stripCodeFences(value: string) {
  return value.replace(/```[\s\S]*?```/g, " ");
}

function stripJsx(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function stripInlineFormatting(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~>#|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toPlainText(value: string) {
  return stripInlineFormatting(stripJsx(stripCodeFences(value)));
}

function extractTopImports(body: string) {
  const lines = body.split("\n");
  const imports: string[] = [];
  let index = 0;
  let sawImport = false;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      if (!sawImport) {
        index += 1;
        continue;
      }

      imports.push(line);
      index += 1;
      continue;
    }

    if (/^import\s.+from\s+['"][^'"]+['"];?$/.test(trimmed)) {
      imports.push(line);
      sawImport = true;
      index += 1;
      continue;
    }

    break;
  }

  return {
    imports,
    content: lines.slice(index).join("\n"),
  };
}

function extractHeadings(body: string): DocHeading[] {
  const slugger = new GithubSlugger();
  const headings: DocHeading[] = [];
  let inFence = false;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();

    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }

    if (inFence) continue;

    const match = /^(#{2,3})\s+(.*)$/.exec(line);
    if (!match) continue;

    const text = stripInlineFormatting(match[2]);
    if (!text) continue;

    headings.push({
      depth: match[1].length,
      text,
      id: slugger.slug(text),
    });
  }

  return headings;
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getManifest() {
  if (manifestCache) return manifestCache;
  const raw = await fs.readFile(MANIFEST_PATH, "utf8");
  manifestCache = (JSON.parse(raw) as ManifestEntry[]).filter((entry) => entry.isPublic);
  return manifestCache;
}

export async function getManifestMap() {
  const manifest = await getManifest();
  return new Map(manifest.map((entry) => [normalizeUrl(entry.publicUrl), entry]));
}

export async function getDocByPublicUrl(publicUrl: string): Promise<DocRecord | null> {
  const normalized = normalizeUrl(publicUrl);
  const manifestMap = await getManifestMap();
  const entry = normalized === "/docs" ? manifestMap.get("/docs/overview") : manifestMap.get(normalized);

  if (!entry) return null;

  if (!docCache.has(entry.publicUrl)) {
    docCache.set(entry.publicUrl, loadDocRecord(entry));
  }

  return docCache.get(entry.publicUrl)!;
}

async function loadDocRecord(entry: ManifestEntry): Promise<DocRecord> {
  const outputPathAbs = path.join(ROOT, entry.outputPath);
  const raw = await fs.readFile(outputPathAbs, "utf8");
  const parsed = matter(raw);
  const { content } = extractTopImports(parsed.content);
  const slugSegments = entry.publicUrl.replace(/^\/docs\/?/, "").split("/").filter(Boolean);
  const section = slugSegments.length > 1 ? slugSegments[0] : null;
  const excerpt = toPlainText(content).slice(0, 240).trim();

  return {
    title: String(parsed.data.title ?? titleFromSlug(slugSegments.at(-1) ?? "docs")),
    description: String(parsed.data.description ?? ""),
    pubDate: parsed.data.pubDate ? String(parsed.data.pubDate) : undefined,
    publicUrl: normalizeUrl(entry.publicUrl),
    sourcePath: entry.sourcePath,
    outputPath: entry.outputPath,
    outputPathAbs,
    slugSegments,
    section,
    body: content,
    excerpt,
    headings: extractHeadings(content),
  };
}

export async function getAllDocs() {
  const manifest = await getManifest();
  const docs = await Promise.all(manifest.map((entry) => getDocByPublicUrl(entry.publicUrl)));
  return docs.filter(Boolean) as DocRecord[];
}

export function getDocCount(docs: DocRecord[]) {
  return docs.filter((doc) => doc.publicUrl !== "/docs/overview").length;
}

export async function getAllDocParams() {
  const manifest = await getManifest();
  return [
    { slug: [] as string[] },
    ...manifest.map((entry) => ({
      slug: entry.publicUrl.replace(/^\/docs\/?/, "").split("/").filter(Boolean),
    })),
  ];
}

async function getDirectoryChildren(prefix: string) {
  const manifest = await getManifest();
  const docs = manifest
    .filter((entry) => normalizeUrl(entry.publicUrl).startsWith(`${prefix}/`))
    .map((entry) => normalizeUrl(entry.publicUrl));

  const relativeDir = prefix.replace(/^\/docs\/?/, "");
  const directoryPath = path.join(DOCS_ROOT, relativeDir);
  const meta = await readJson<Array<string | [string, string]>>(path.join(directoryPath, "_meta.json"));
  const map = await readJson<Array<[string, string]>>(path.join(directoryPath, "_map.json"));

  if (meta) {
    const items: SidebarItem[] = [];

    for (const entry of meta) {
      if (entry === "---") {
        items.push({ kind: "divider" });
        continue;
      }

      if (typeof entry === "string") {
        items.push({ kind: "heading", title: entry.replace(/::$/, "") });
        continue;
      }

      const [slug, title] = entry;
      const href = `${prefix}/${slug}`.replace(/\/+/g, "/");
      if (docs.includes(href)) {
        items.push({
          kind: "link",
          title,
          href,
          active: false,
        });
      }
    }

    return items;
  }

  if (map) {
    return map
      .map(([slug, title]) => ({
        kind: "link" as const,
        title,
        href: `${prefix}/${slug}`.replace(/\/+/g, "/"),
        active: false,
      }))
      .filter((item) => docs.includes(item.href));
  }

  const docRecords = await Promise.all(
    docs.map((href) => getDocByPublicUrl(href)),
  );

  return docRecords
    .filter(Boolean)
    .sort((a, b) => {
      if (prefix === "/docs/latest-releases") {
        return new Date(b!.pubDate ?? 0).getTime() - new Date(a!.pubDate ?? 0).getTime();
      }

      return a!.title.localeCompare(b!.title, "ko");
    })
    .map((doc) => ({
      kind: "link" as const,
      title: doc!.title,
      href: doc!.publicUrl,
      active: false,
    }));
}

export async function getSidebarItems(currentUrl: string): Promise<SidebarItem[]> {
  const rootMeta = (await readJson<Array<string | [string, string]>>(
    path.join(DOCS_ROOT, "_meta.json"),
  )) ?? [];
  const manifest = await getManifest();
  const manifestUrls = new Set(manifest.map((entry) => normalizeUrl(entry.publicUrl)));
  const normalizedCurrent = normalizeUrl(currentUrl);
  const items: SidebarItem[] = [];

  for (const entry of rootMeta) {
    if (entry === "---") {
      items.push({ kind: "divider" });
      continue;
    }

    if (typeof entry === "string") {
      items.push({ kind: "heading", title: entry.replace(/::$/, "") });
      continue;
    }

    const [slug, title] = entry;
    const href = `/docs/${slug}`.replace(/\/+/g, "/");
    if (!manifestUrls.has(href)) continue;

    const hasChildren = manifest.some(
      (item) => normalizeUrl(item.publicUrl).startsWith(`${href}/`),
    );

    items.push({
      kind: "link",
      title,
      href,
      active: normalizedCurrent === href || normalizedCurrent.startsWith(`${href}/`),
      children: hasChildren ? await getDirectoryChildren(href) : undefined,
    });
  }

  return items;
}

export async function getDocBreadcrumbs(publicUrl: string) {
  const doc = await getDocByPublicUrl(publicUrl);
  if (!doc) {
    return [{ title: "문서", href: "/docs" }];
  }

  const crumbs = [{ title: "문서", href: "/docs" }];

  if (doc.slugSegments.length > 1) {
    const parentHref = `/docs/${doc.slugSegments[0]}`;
    const parentDoc = await getDocByPublicUrl(parentHref);
    crumbs.push({
      title: parentDoc?.title ?? titleFromSlug(doc.slugSegments[0]),
      href: parentHref,
    });
  }

  crumbs.push({
    title: doc.title,
    href: doc.publicUrl,
  });

  return crumbs;
}

export async function getFeaturedDocs() {
  const docs = await Promise.all([
    getDocByPublicUrl("/docs/get-started"),
    getDocByPublicUrl("/docs/guides"),
    getDocByPublicUrl("/docs/tutorials"),
    getDocByPublicUrl("/docs/latest-releases"),
  ]);

  return docs.filter(Boolean) as DocRecord[];
}

export async function getGuideDocs(limit = 8) {
  const manifest = await getManifest();
  const guides = manifest
    .filter((entry) => normalizeUrl(entry.publicUrl).startsWith("/docs/guides/"))
    .slice(0, limit);

  const docs = await Promise.all(guides.map((entry) => getDocByPublicUrl(entry.publicUrl)));
  return docs.filter(Boolean) as DocRecord[];
}

export async function getLatestReleaseDocs(limit = 6) {
  const docs = await getAllDocs();

  return docs
    .filter((doc) => doc.publicUrl.startsWith("/docs/latest-releases/"))
    .sort(
      (a, b) => new Date(b.pubDate ?? 0).getTime() - new Date(a.pubDate ?? 0).getTime(),
    )
    .slice(0, limit);
}

export async function getTutorialDocs(limit = 6) {
  const docs = await getAllDocs();

  return docs
    .filter((doc) => doc.publicUrl.startsWith("/docs/tutorials/"))
    .sort((a, b) => a.title.localeCompare(b.title, "ko"))
    .slice(0, limit);
}

export async function getSearchRecords(): Promise<SearchRecord[]> {
  const docs = await getAllDocs();

  return docs.flatMap((doc) => {
    const breadcrumb = ["문서"];
    if (doc.section) {
      breadcrumb.push(titleFromSlug(doc.section));
    }

    const baseRecord: SearchRecord = {
      id: doc.publicUrl,
      title: doc.title,
      description: doc.description,
      excerpt: doc.excerpt,
      url: doc.publicUrl,
      section: doc.section ?? undefined,
      breadcrumb,
      keywords: [doc.title, doc.description, doc.excerpt].filter(Boolean),
    };

    const headingRecords = doc.headings.map((heading) => ({
      id: `${doc.publicUrl}#${heading.id}`,
      title: heading.text,
      description: doc.title,
      excerpt: doc.excerpt,
      url: `${doc.publicUrl}#${heading.id}`,
      section: doc.section ?? undefined,
      breadcrumb: [...breadcrumb, doc.title],
      anchor: heading.id,
      keywords: [heading.text, doc.title, doc.description, doc.excerpt].filter(Boolean),
    }));

    return [baseRecord, ...headingRecords];
  });
}

export async function resolvePublicAsset(filePath: string) {
  const normalized = filePath.replace(/^\/public/, "");
  const absolute = path.join(ROOT, normalized.startsWith("/") ? normalized.slice(1) : normalized);
  return (await fileExists(absolute)) ? normalized : filePath;
}
