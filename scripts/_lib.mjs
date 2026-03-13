import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";

export const UPSTREAM_REPO_URL =
  "https://github.com/drizzle-team/drizzle-orm-docs.git";
export const UPSTREAM_COMMIT =
  "c98e4f6b17e3d828a4bfb46b6cfabcaf505b036e";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const DOCS_DIR = path.join(ROOT, "src", "content", "docs");
export const DOCS_KO_DIR = path.join(ROOT, "src", "content", "docs-ko");
export const MDX_DIR = path.join(ROOT, "src", "mdx");
export const MDX_KO_DIR = path.join(ROOT, "src", "mdx-ko");
export const UI_COMPONENTS_DIR = path.join(ROOT, "src", "ui", "components");
export const UI_COMPONENTS_KO_DIR = path.join(
  ROOT,
  "src",
  "ui",
  "components-ko",
);
export const TRANSLATION_DIR = path.join(ROOT, "translation");
export const MANIFEST_PATH = path.join(TRANSLATION_DIR, "manifest.json");
export const UPSTREAM_CACHE_DIR = path.join(ROOT, ".upstream-cache");

export const SOURCE_ONLY_DOCS = new Set([
  "faq.mdx",
  "kit-seed-data.mdx",
  "quick.mdx",
  "seed-limitations.mdx",
  "upgrade-21.mdx",
  "why-drizzle.mdx",
]);

export const KO_UI_COMPONENT_FILES = [
  "Guides.astro",
  "LatestReleases.astro",
  "Tutorials.astro",
];

const ROOT_META_SKIP = new Set(["seed-get-started", "perf-benchmarks"]);
const ROUTE_DIRS = new Set(["guides", "tutorials", "latest-releases", "migrate"]);

export function toPosix(value) {
  return value.split(path.sep).join("/");
}

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

export async function writeText(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, value, "utf8");
}

export async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

export async function writeJson(filePath, value) {
  await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function parseFrontmatter(source) {
  return matter(source);
}

export function relativeFrom(root, filePath) {
  return toPosix(path.relative(root, filePath));
}

export async function walkFiles(rootDir, predicate = () => true) {
  const entries = [];

  async function walk(dirPath) {
    const children = await fs.readdir(dirPath, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));

    for (const child of children) {
      const fullPath = path.join(dirPath, child.name);
      if (child.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (predicate(fullPath)) {
        entries.push(fullPath);
      }
    }
  }

  if (await exists(rootDir)) {
    await walk(rootDir);
  }

  return entries;
}

function guideSlugFromSource(relativePath, source) {
  const { data } = parseFrontmatter(source);
  if (typeof data.slug === "string" && data.slug.length > 0) {
    return data.slug;
  }

  return path.basename(relativePath, ".mdx");
}

async function buildPublicRouteMap() {
  const routeMap = new Map();
  const rootMeta = await readJson(path.join(DOCS_DIR, "_meta.json"));
  const getStartedMeta = await readJson(path.join(DOCS_DIR, "get-started", "_meta.json"));

  for (const item of rootMeta) {
    if (!Array.isArray(item)) {
      continue;
    }

    const [slug] = item;
    if (ROOT_META_SKIP.has(slug)) {
      continue;
    }

    if (slug === "column-types" || slug === "extensions") {
      const sectionDir = path.join(DOCS_DIR, slug);
      const sectionFiles = await walkFiles(
        sectionDir,
        (value) => value.endsWith(".mdx"),
      );

      for (const sectionFile of sectionFiles) {
        const relativePath = relativeFrom(DOCS_DIR, sectionFile);
        const basename = path.basename(relativePath, ".mdx");
        routeMap.set(relativePath, `/docs/${slug}/${basename}`);
      }
      continue;
    }

    routeMap.set(`${slug}.mdx`, `/docs/${slug}`);
  }

  for (const item of getStartedMeta) {
    if (!Array.isArray(item)) {
      continue;
    }

    const [slug] = item;
    routeMap.set(`get-started/${slug}.mdx`, `/docs/get-started/${slug}`);
  }

  for (const routeDir of ROUTE_DIRS) {
    const routeFiles = await walkFiles(
      path.join(DOCS_DIR, routeDir),
      (value) => value.endsWith(".mdx"),
    );

    for (const routeFile of routeFiles) {
      const relativePath = relativeFrom(DOCS_DIR, routeFile);
      const source = await readText(routeFile);
      const basename = path.basename(relativePath, ".mdx");

      if (routeDir === "guides") {
        routeMap.set(
          relativePath,
          `/docs/guides/${guideSlugFromSource(relativePath, source)}`,
        );
        continue;
      }

      routeMap.set(relativePath, `/docs/${routeDir}/${basename}`);
    }
  }

  return routeMap;
}

export async function buildDocsManifest() {
  const sourceFiles = await walkFiles(DOCS_DIR, (value) => value.endsWith(".mdx"));
  const publicRouteMap = await buildPublicRouteMap();
  const entries = [];

  for (const sourceFile of sourceFiles) {
    const source = await readText(sourceFile);
    const relativePath = relativeFrom(DOCS_DIR, sourceFile);
    const outputPath = relativeFrom(ROOT, path.join(DOCS_KO_DIR, relativePath));
    const publicUrl = publicRouteMap.get(relativePath) ?? null;

    entries.push({
      sourcePath: relativeFrom(ROOT, sourceFile),
      publicUrl,
      outputPath,
      sourceSha: sha256(source),
      status: "pending",
      isPublic: publicUrl !== null,
      notes: SOURCE_ONLY_DOCS.has(relativePath)
        ? ["source-only"]
        : relativePath === "guides/seeding-with-partially-exposed-schema.mdx"
          ? ["public-slug-alias:/docs/guides/seeding-with-partially-exposed-tables"]
          : [],
    });
  }

  entries.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  return entries;
}

export function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }

    const flag = item.slice(2);
    const [key, inlineValue] = flag.split("=", 2);

    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

export function assertPinnedManifest(entries) {
  const publicCount = entries.filter((entry) => entry.isPublic).length;
  if (entries.length !== 245) {
    throw new Error(`Expected 245 docs, received ${entries.length}`);
  }
  if (publicCount !== 239) {
    throw new Error(`Expected 239 public docs, received ${publicCount}`);
  }
}
