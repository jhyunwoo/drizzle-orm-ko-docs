import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

import { compile } from "@mdx-js/mdx";

import {
  assertPinnedManifest,
  DOCS_KO_DIR,
  MANIFEST_PATH,
  MDX_KO_DIR,
  ROOT,
  UI_COMPONENTS_KO_DIR,
  exists,
  parseArgs,
  parseFrontmatter,
  readJson,
  readText,
  walkFiles,
} from "./_lib.mjs";

const execFile = promisify(execFileCallback);
const args = parseArgs(process.argv.slice(2));
const issues = [];

function countMatches(text, pattern) {
  const matched = text.match(pattern);
  return matched ? matched.length : 0;
}

function stripForAudit(text) {
  return text
    .replace(/^import .*$/gm, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]+`/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\/docs\/[A-Za-z0-9\-_/]+/g, " ")
    .replace(/<[^>]+>/g, " ");
}

const ENGLISH_ALLOWLIST = new Set([
  "api",
  "arktype",
  "bun",
  "cli",
  "cockroachdb",
  "drizzle",
  "effect",
  "env",
  "gel",
  "github",
  "http",
  "https",
  "javascript",
  "json",
  "libsql",
  "mdx",
  "mssql",
  "mysql",
  "neon",
  "next",
  "node",
  "npm",
  "orm",
  "pg",
  "pglite",
  "planetscale",
  "pnpm",
  "postgres",
  "postgresql",
  "prisma",
  "react",
  "rls",
  "sql",
  "sqlite",
  "singlestore",
  "supabase",
  "tab",
  "tabs",
  "tidb",
  "turso",
  "typebox",
  "typescript",
  "url",
  "valibot",
  "vercel",
  "xata",
  "yaml",
  "yarn",
  "zod",
]);

function collectEnglishResidue(text) {
  const candidates = stripForAudit(text).match(/[A-Za-z][A-Za-z'-]{3,}/g) ?? [];
  return [...new Set(candidates.map((value) => value.toLowerCase()))].filter(
    (value) => !ENGLISH_ALLOWLIST.has(value),
  );
}

async function verifyMdxFile(filePath) {
  const source = await readText(filePath);
  try {
    await compile(source, { jsx: true, format: "mdx" });
  } catch (error) {
    issues.push(`MDX parse failed: ${path.relative(ROOT, filePath)} :: ${error.message}`);
  }
}

async function verifyAstroFile(filePath) {
  const source = await readText(filePath);
  const frontmatterBlocks = countMatches(source, /^---$/gm);
  if (frontmatterBlocks % 2 !== 0) {
    issues.push(`Astro frontmatter fence mismatch: ${path.relative(ROOT, filePath)}`);
  }
}

const manifest = await readJson(MANIFEST_PATH);
assertPinnedManifest(manifest);

for (const entry of manifest) {
  const sourcePath = path.join(ROOT, entry.sourcePath);
  const outputPath = path.join(ROOT, entry.outputPath);

  if (!(await exists(outputPath))) {
    issues.push(`Missing translated file: ${entry.outputPath}`);
    continue;
  }

  const [sourceText, outputText] = await Promise.all([
    readText(sourcePath),
    readText(outputPath),
  ]);

  const sourceMatter = parseFrontmatter(sourceText);
  const outputMatter = parseFrontmatter(outputText);
  const sourceKeys = Object.keys(sourceMatter.data).sort().join(",");
  const outputKeys = Object.keys(outputMatter.data).sort().join(",");

  if (sourceKeys !== outputKeys) {
    issues.push(`Frontmatter key mismatch: ${entry.outputPath}`);
  }

  if (countMatches(sourceText, /```/g) !== countMatches(outputText, /```/g)) {
    issues.push(`Code fence mismatch: ${entry.outputPath}`);
  }

  if (
    countMatches(sourceText, /^import .*$/gm) !==
    countMatches(outputText, /^import .*$/gm)
  ) {
    issues.push(`Import count mismatch: ${entry.outputPath}`);
  }

  if (countMatches(sourceText, /`[^`\n]+`/g) !== countMatches(outputText, /`[^`\n]+`/g)) {
    issues.push(`Inline code count mismatch: ${entry.outputPath}`);
  }

  const residue = collectEnglishResidue(outputText);
  if (residue.length > 0) {
    issues.push(
      `English residue in ${entry.outputPath}: ${residue.slice(0, 12).join(", ")}`,
    );
  }
}

const mdxFiles = [
  ...(await walkFiles(DOCS_KO_DIR, (value) => value.endsWith(".mdx"))),
  ...(await walkFiles(MDX_KO_DIR, (value) => value.endsWith(".mdx"))),
];
for (const mdxFile of mdxFiles) {
  await verifyMdxFile(mdxFile);
}

const astroFiles = [
  ...(await walkFiles(MDX_KO_DIR, (value) => value.endsWith(".astro"))),
  ...(await walkFiles(UI_COMPONENTS_KO_DIR, (value) => value.endsWith(".astro"))),
];
for (const astroFile of astroFiles) {
  await verifyAstroFile(astroFile);
}

if (args["astro-check"]) {
  await execFile("pnpm", ["exec", "astro", "check"], { cwd: ROOT });
}

if (issues.length > 0) {
  console.error(`Verification failed with ${issues.length} issue(s):`);
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(
  `Verified ${manifest.length} translated docs, ${mdxFiles.length} Korean MDX helper files, and ${astroFiles.length} Astro helper files.`,
);
