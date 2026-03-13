import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import GithubSlugger from "github-slugger";

const root = process.cwd();
const manifestPath = path.join(root, "translation", "manifest.json");
const outPath = path.join(root, "public", "search-index.json");
const assetSource = path.join(root, "src", "assets", "images");
const assetTarget = path.join(root, "public", "assets", "images");

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")).filter((entry) => entry.isPublic);

function stripCodeFences(value) {
  return value.replace(/```[\s\S]*?```/g, " ");
}

function stripMdx(value) {
  return stripCodeFences(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~>#|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadings(content) {
  const slugger = new GithubSlugger();
  const headings = [];
  let inFence = false;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{2,3})\s+(.*)$/.exec(line);
    if (!match) continue;

    const text = stripMdx(match[2]);
    if (!text) continue;

    headings.push({
      depth: match[1].length,
      text,
      id: slugger.slug(text),
    });
  }

  return headings;
}

function extractBody(content) {
  const lines = content.split("\n");
  let index = 0;
  let sawImport = false;

  while (index < lines.length) {
    const trimmed = lines[index].trim();

    if (!trimmed) {
      if (!sawImport) {
        index += 1;
        continue;
      }
      index += 1;
      continue;
    }

    if (/^import\s.+from\s+['"][^'"]+['"];?$/.test(trimmed)) {
      sawImport = true;
      index += 1;
      continue;
    }

    break;
  }

  return lines.slice(index).join("\n");
}

const records = [];

for (const entry of manifest) {
  const filePath = path.join(root, entry.outputPath);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  const body = extractBody(parsed.content);
  const plain = stripMdx(body);
  const excerpt = plain.slice(0, 160).trim();
  const section = entry.publicUrl.replace(/^\/docs\/?/, "").split("/").filter(Boolean)[0];
  const breadcrumb = ["문서"];

  if (section && section !== "overview") breadcrumb.push(section.replaceAll("-", " "));

  const keywords = [...new Set([parsed.data.title, parsed.data.description, excerpt].filter(Boolean))];

  records.push({
    id: entry.publicUrl,
    title: parsed.data.title || entry.publicUrl,
    description: parsed.data.description || "",
    excerpt,
    url: entry.publicUrl,
    section,
    breadcrumb,
    keywords,
  });

  for (const heading of extractHeadings(body)) {
    records.push({
      id: `${entry.publicUrl}#${heading.id}`,
      title: heading.text,
      description: parsed.data.title || "",
      excerpt,
      url: `${entry.publicUrl}#${heading.id}`,
      section,
      breadcrumb: [...breadcrumb, parsed.data.title || ""].filter(Boolean),
      anchor: heading.id,
      keywords: [...new Set([heading.text, parsed.data.title, parsed.data.description, excerpt].filter(Boolean))],
    });
  }
}

await fs.writeFile(outPath, JSON.stringify(records));
await fs.mkdir(path.dirname(assetTarget), { recursive: true });
await fs.cp(assetSource, assetTarget, { recursive: true });
console.log(`Wrote ${records.length} search records to ${path.relative(root, outPath)}`);
