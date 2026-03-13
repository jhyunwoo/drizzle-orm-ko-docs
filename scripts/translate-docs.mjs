import { spawn } from "node:child_process";
import path from "node:path";

import matter from "gray-matter";

import {
  DOCS_DIR,
  DOCS_KO_DIR,
  KO_UI_COMPONENT_FILES,
  MANIFEST_PATH,
  MDX_DIR,
  MDX_KO_DIR,
  ROOT,
  TRANSLATION_DIR,
  UI_COMPONENTS_DIR,
  UI_COMPONENTS_KO_DIR,
  assertPinnedManifest,
  buildDocsManifest,
  ensureDir,
  exists,
  parseArgs,
  parseFrontmatter,
  readJson,
  readText,
  relativeFrom,
  sha256,
  walkFiles,
  writeJson,
  writeText,
} from "./_lib.mjs";

const args = parseArgs(process.argv.slice(2));
const provider = args.provider ?? (process.env.OPENAI_API_KEY ? "openai" : "ollama");
const model =
  args.model ??
  (provider === "openai"
    ? process.env.OPENAI_MODEL || "gpt-4.1-mini"
    : provider === "argos"
      ? "argos-translate"
    : provider === "mymemory"
      ? "mymemory"
    : provider === "ollama"
      ? process.env.OLLAMA_MODEL || "gpt-oss:20b"
      : "google-translate");
const limit = args.limit !== undefined ? Number(args.limit) : null;
const force = Boolean(args.force);
const filter = typeof args.filter === "string" ? args.filter : null;
const skipMeta = Boolean(args["skip-meta"]);
const skipMdxLayer = Boolean(args["skip-mdx-layer"]);
const skipUiComponents = Boolean(args["skip-ui-components"]);
const skipDocs = Boolean(args["skip-docs"]);
const maxChars =
  args["max-chars"] !== undefined
    ? Number(args["max-chars"])
    : provider === "mymemory"
      ? 360
      : provider === "ollama"
        ? 1800
      : 5200;
const googleMinIntervalMs =
  args["google-min-interval"] !== undefined
    ? Number(args["google-min-interval"])
    : 1500;
const concurrency =
  args.concurrency !== undefined
    ? Number(args.concurrency)
    : provider === "google" || provider === "mymemory"
      ? 1
      : 1;
const CACHE_PATH = path.join(TRANSLATION_DIR, "cache.json");
const CACHE_FLUSH_EVERY = 10;
const argosPythonPath =
  args["argos-python"] ?? path.join(ROOT, ".venv39", "bin", "python");
const argosBridgeScriptPath = path.join(ROOT, "scripts", "argos_translate.py");

const DOC_COMPONENT_IMPORT_REWRITES = new Map([
  ['from "@components/Guides.astro"', 'from "@components-ko/Guides.astro"'],
  ['from "@components/Tutorials.astro"', 'from "@components-ko/Tutorials.astro"'],
  [
    'from "@components/LatestReleases.astro"',
    'from "@components-ko/LatestReleases.astro"',
  ],
]);

const TRANSLATABLE_STRING_ATTRS = new Set(["title", "collapsed", "alt"]);
const PROTECTED_COMPONENT_BLOCKS = new Set(["Npm", "Npx", "NpxCompact"]);
const SKIP_TRANSLATION_EXPR_ATTRS = new Set([
  "class",
  "className",
  "devlib",
  "dialect",
  "emoji",
  "env_variable",
  "href",
  "id",
  "lib",
  "path",
  "query",
  "rel",
  "src",
  "style",
  "target",
  "type",
]);
const NO_TRANSLATE_PHRASES = [
  "Cloudflare Durable Objects",
  "Cloudflare D1",
  "PlanetScale Postgres",
  "React Native SQLite",
  "Vercel Postgres",
  "AWS Data API",
  "Turso Database",
  "Bun SQLite",
  "Expo SQLite",
  "OP SQLite",
  "Bun SQL",
  "Drizzle Studio",
  "Drizzle Proxy",
  "Drizzle ORM",
  "Drizzle Kit",
  "React Native",
  "CockroachDB",
  "PostgreSQL",
  "SingleStore",
  "PlanetScale",
  "TypeScript",
  "JavaScript",
  "Prisma Postgres",
  "GraphQL",
  "Arktype",
  "TypeBox",
  "Valibot",
  "Supabase",
  "PGLite",
  "libsql",
  "SQLite",
  "Turso",
  "Neon",
  "Xata",
  "Nile",
  "Effect",
  "TiDB",
  "Prisma",
  "MySQL",
  "MSSQL",
  "React",
  "Bun",
  "Gel",
  "SQL",
  "Drizzle",
].sort((left, right) => right.length - left.length);

const translationCache = {
  version: 1,
  provider,
  model,
  entries: {},
};
const inFlightTranslations = new Map();
let cacheDirtyWrites = 0;
let lastGoogleRequestAt = 0;
let argosProcess = null;
let argosReadyPromise = null;
let argosStdoutBuffer = "";
let argosRequestId = 0;
const argosPending = new Map();
const PLACEHOLDER_TOKEN_RE = /ZX(?:INLINE|TERM|TAG|EXPR)\d+QZ/g;
const BANNED_OUTPUT_PATTERNS = [/CODEX\s+(?:TERM|INLINE)/i, /카지노사이트/];

function buildPrompt(instructions, source) {
  return `${instructions.trim()}\n\n### Input\n${source}`;
}

function escapeRegex(source) {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function cleanupModelOutput(output) {
  return output
    .replace(/^```(?:mdx|markdown)?\n?/i, "")
    .replace(/\n```$/, "")
    .trimEnd();
}

function collectPlaceholderTokens(value) {
  return value.match(PLACEHOLDER_TOKEN_RE) ?? [];
}

function countValues(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function ensureProtectedTokensPreserved(source, output, contextLabel) {
  const expected = countValues(collectPlaceholderTokens(source));
  if (expected.size === 0) {
    return;
  }

  const actual = countValues(collectPlaceholderTokens(output));
  for (const [token, count] of expected) {
    if ((actual.get(token) ?? 0) !== count) {
      throw new Error(
        `${contextLabel}: placeholder token mismatch for ${token} (expected ${count}, got ${actual.get(token) ?? 0})`,
      );
    }
  }

  for (const [token, count] of actual) {
    if (!expected.has(token)) {
      throw new Error(
        `${contextLabel}: unexpected placeholder token ${token} appeared ${count} time(s)`,
      );
    }
  }
}

function ensureOutputNotContaminated(source, output, contextLabel) {
  for (const pattern of BANNED_OUTPUT_PATTERNS) {
    if (pattern.test(output) && !pattern.test(source)) {
      throw new Error(`${contextLabel}: banned output pattern matched ${pattern}`);
    }
  }
}

async function loadCache() {
  if (!(await exists(CACHE_PATH))) {
    return;
  }

  const cached = await readJson(CACHE_PATH);
  if (!cached || typeof cached !== "object" || typeof cached.entries !== "object") {
    return;
  }

  translationCache.version = cached.version ?? translationCache.version;
  translationCache.provider = cached.provider ?? translationCache.provider;
  translationCache.model = cached.model ?? translationCache.model;
  translationCache.entries = cached.entries ?? {};
}

async function flushCache(forceWrite = false) {
  if (!forceWrite && cacheDirtyWrites < CACHE_FLUSH_EVERY) {
    return;
  }

  await writeJson(CACHE_PATH, translationCache);
  cacheDirtyWrites = 0;
}

function cacheKey(kind, source) {
  return sha256([translationCache.provider, translationCache.model, kind, source].join("\n"));
}

function rejectPendingArgosRequests(error) {
  for (const { reject } of argosPending.values()) {
    reject(error);
  }
  argosPending.clear();
}

function handleArgosOutputLine(line, readyState) {
  if (!line.trim()) {
    return;
  }

  let payload;
  try {
    payload = JSON.parse(line);
  } catch (error) {
    console.warn(`[argos] failed to parse output: ${line}`);
    return;
  }

  if (payload.ready) {
    readyState.resolve();
    return;
  }

  if (!payload.id) {
    return;
  }

  const pending = argosPending.get(String(payload.id));
  if (!pending) {
    return;
  }

  argosPending.delete(String(payload.id));

  if (payload.error) {
    pending.reject(new Error(payload.error));
    return;
  }

  pending.resolve(payload.text ?? "");
}

async function ensureArgosProcess() {
  if (argosReadyPromise) {
    return argosReadyPromise;
  }

  argosReadyPromise = new Promise((resolve, reject) => {
    const readyState = { settled: false };
    readyState.resolve = () => {
      if (!readyState.settled) {
        readyState.settled = true;
        resolve();
      }
    };
    readyState.reject = (error) => {
      if (!readyState.settled) {
        readyState.settled = true;
        reject(error);
      }
    };

    argosProcess = spawn(argosPythonPath, [argosBridgeScriptPath, "--stdio"], {
      cwd: ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });

    argosProcess.stdout.setEncoding("utf8");
    argosProcess.stdout.on("data", (chunk) => {
      argosStdoutBuffer += chunk;
      const lines = argosStdoutBuffer.split("\n");
      argosStdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        handleArgosOutputLine(line, readyState);
      }
    });

    argosProcess.stderr.setEncoding("utf8");
    argosProcess.stderr.on("data", (chunk) => {
      const trimmed = chunk.trim();
      if (trimmed.length > 0) {
        console.warn(`[argos] ${trimmed}`);
      }
    });

    argosProcess.on("error", (error) => {
      readyState.reject(error);
      rejectPendingArgosRequests(error);
      argosReadyPromise = null;
      argosProcess = null;
    });

    argosProcess.on("exit", (code, signal) => {
      const error = new Error(
        `Argos translation bridge exited unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"})`,
      );
      readyState.reject(error);
      rejectPendingArgosRequests(error);
      argosReadyPromise = null;
      argosProcess = null;
    });
  });

  return argosReadyPromise;
}

async function callOpenAI(instructions, source) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      instructions,
      input: source,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  if (typeof payload.output_text === "string" && payload.output_text.length > 0) {
    return payload.output_text;
  }

  const outputText = payload.output
    ?.flatMap((item) => item.content ?? [])
    ?.find((item) => item.type === "output_text")?.text;

  if (!outputText) {
    throw new Error("OpenAI response did not contain output_text");
  }

  return outputText;
}

async function callGoogle(source) {
  const waitMs = Math.max(0, lastGoogleRequestAt + googleMinIntervalMs - Date.now());
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  lastGoogleRequestAt = Date.now();

  const body = new URLSearchParams({
    client: "gtx",
    sl: "en",
    tl: "ko",
    dt: "t",
    dj: "1",
    q: source,
  });

  const response = await fetch("https://translate.googleapis.com/translate_a/single", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "Mozilla/5.0",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = new Error(
      `Google Translate request failed: ${response.status} ${await response.text()}`,
    );
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  const translated = payload.sentences?.map((sentence) => sentence.trans ?? "").join("");

  if (!translated) {
    throw new Error("Google Translate response did not contain translated text");
  }

  return translated;
}

async function callMyMemory(source) {
  const searchParams = new URLSearchParams({
    q: source,
    langpair: "en|ko",
  });
  const response = await fetch(
    `https://api.mymemory.translated.net/get?${searchParams.toString()}`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    },
  );

  if (!response.ok) {
    const error = new Error(
      `MyMemory request failed: ${response.status} ${await response.text()}`,
    );
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  if (payload.responseStatus !== 200) {
    const error = new Error(
      `MyMemory request failed: ${payload.responseStatus} ${payload.responseDetails ?? ""}`.trim(),
    );
    error.status = payload.responseStatus;
    throw error;
  }

  if (typeof payload.responseData?.translatedText !== "string") {
    throw new Error("MyMemory response did not contain translated text");
  }

  return payload.responseData.translatedText;
}

async function callArgos(source) {
  await ensureArgosProcess();

  const id = String(++argosRequestId);
  const translation = new Promise((resolve, reject) => {
    argosPending.set(id, { resolve, reject });
  });

  argosProcess.stdin.write(`${JSON.stringify({ id, text: source })}\n`);
  return translation;
}

async function callOllama(instructions, source) {
  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: buildPrompt(instructions, source),
      stream: false,
      options: {
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  if (!payload.response) {
    throw new Error("Ollama response was empty");
  }
  return payload.response;
}

async function callModel(instructions, source) {
  if (provider === "openai") {
    return callOpenAI(instructions, source);
  }
  if (provider === "argos") {
    return callArgos(source);
  }
  if (provider === "mymemory") {
    return callMyMemory(source);
  }
  if (provider === "google") {
    return callGoogle(source);
  }
  if (provider === "ollama") {
    return callOllama(instructions, source);
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

async function callModelWithRetry(instructions, source, contextLabel) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const output = await callModel(instructions, source);
      return cleanupModelOutput(output);
    } catch (error) {
      lastError = error;
      console.warn(`[retry ${attempt}/3] ${contextLabel}: ${error.message}`);
      const retryDelay = error.status === 429 ? 30000 * attempt : 1000 * attempt;
      await sleep(retryDelay);
    }
  }

  throw lastError;
}

function rewriteMdxImports(source) {
  let output = source.replaceAll("@mdx/", "@mdx-ko/");
  for (const [from, to] of DOC_COMPONENT_IMPORT_REWRITES) {
    output = output.replaceAll(from, to);
  }
  return output;
}

function protectInlineTokens(source) {
  const tokens = [];
  let protectedText = source;

  const patterns = [
    /`[^`\n]+`/g,
    /https?:\/\/[^\s)]+/g,
  ];

  for (const pattern of patterns) {
    protectedText = protectedText.replace(pattern, (match) => {
      const token = `ZXINLINE${tokens.length}QZ`;
      tokens.push(match);
      return token;
    });
  }

  return {
    protectedText,
    restore(value) {
      return tokens.reduce(
        (current, token, index) => current.replaceAll(`ZXINLINE${index}QZ`, token),
        value,
      );
    },
  };
}

function protectGlossaryTerms(source) {
  const tokens = [];
  let protectedText = source;

  for (const phrase of NO_TRANSLATE_PHRASES) {
    const pattern = new RegExp(escapeRegex(phrase), "g");
    protectedText = protectedText.replace(pattern, () => {
      const token = `ZXTERM${tokens.length}QZ`;
      tokens.push(phrase);
      return token;
    });
  }

  return {
    protectedText,
    restore(value) {
      return tokens.reduce(
        (current, token, index) => current.replaceAll(`ZXTERM${index}QZ`, token),
        value,
      );
    },
  };
}

function findQuotedEnd(source, startIndex, quote) {
  for (let index = startIndex + 1; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }

    if (source[index] === quote) {
      return index;
    }
  }

  return -1;
}

function findMatchingBrace(source, startIndex) {
  let depth = 0;
  let quote = null;

  for (let index = startIndex; index < source.length; index += 1) {
    const current = source[index];

    if (quote) {
      if (current === "\\") {
        index += 1;
        continue;
      }

      if (current === quote) {
        quote = null;
      }
      continue;
    }

    if (current === "'" || current === '"' || current === "`") {
      quote = current;
      continue;
    }

    if (current === "{") {
      depth += 1;
      continue;
    }

    if (current === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function looksLikeTagStart(source, startIndex) {
  return /^<\/?[A-Za-z]/.test(source.slice(startIndex));
}

function findTagEnd(source, startIndex) {
  let quote = null;
  let braceDepth = 0;

  for (let index = startIndex + 1; index < source.length; index += 1) {
    const current = source[index];

    if (quote) {
      if (current === "\\") {
        index += 1;
        continue;
      }

      if (current === quote) {
        quote = null;
      }
      continue;
    }

    if (current === "'" || current === '"' || current === "`") {
      quote = current;
      continue;
    }

    if (current === "{") {
      braceDepth += 1;
      continue;
    }

    if (current === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }

    if (current === ">" && braceDepth === 0) {
      return index;
    }
  }

  return -1;
}

function shouldTranslateTextLiteral(source, { force = false } = {}) {
  if (!source || !/[A-Za-z]/.test(source)) {
    return false;
  }

  const trimmed = source.trim();
  if (trimmed.length === 0) {
    return false;
  }

  if (/^https?:\/\//.test(trimmed)) {
    return false;
  }

  if (/^(?:\/|\.\.\/|\.\/)/.test(trimmed)) {
    return false;
  }

  if (/^[A-Z0-9_]+$/.test(trimmed)) {
    return false;
  }

  if (/^[@A-Za-z0-9_.-]+(?:\/[@A-Za-z0-9_.-]+)+$/.test(trimmed)) {
    return false;
  }

  if (!force && /^[a-z0-9_.-]+$/.test(trimmed)) {
    return false;
  }

  return true;
}

function splitMdxBody(source, chunkSize = maxChars) {
  const segments = [];
  const lines = source.split("\n");
  let inCodeFence = false;
  let current = [];

  const flush = () => {
    if (current.length === 0) {
      return;
    }
    segments.push(current.join("\n"));
    current = [];
  };

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      if (!inCodeFence) {
        flush();
        inCodeFence = true;
        current.push(line);
        continue;
      }

      current.push(line);
      flush();
      inCodeFence = false;
      continue;
    }

    if (inCodeFence) {
      current.push(line);
      continue;
    }

    if (/^import .*$/u.test(line)) {
      flush();
      segments.push(line);
      continue;
    }

    if (/^#{1,6}\s/u.test(line) && current.length > 0) {
      flush();
    }

    current.push(line);

    if (current.join("\n").length >= chunkSize && line.trim() === "") {
      flush();
    }
  }

  flush();
  return segments;
}

function shouldTranslateSegment(source) {
  const stripped = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^import .*$/gm, " ")
    .replace(/^export .*$/gm, " ")
    .replace(/`[^`\n]+`/g, " ")
    .replace(/\{[\s\S]*?\}/g, " ")
    .replace(/<[^>]+>/g, " ");
  return /[A-Za-z][A-Za-z'-]{2,}/.test(stripped);
}

async function translateCached(kind, source, instructions, contextLabel) {
  const key = cacheKey(kind, source);
  if (translationCache.entries[key]) {
    return translationCache.entries[key].output;
  }

  if (inFlightTranslations.has(key)) {
    return inFlightTranslations.get(key);
  }

  const work = (async () => {
    const output = await callModelWithRetry(instructions, source, contextLabel);
    ensureProtectedTokensPreserved(source, output, contextLabel);
    ensureOutputNotContaminated(source, output, contextLabel);
    translationCache.entries[key] = {
      kind,
      source,
      output,
    };
    cacheDirtyWrites += 1;
    await flushCache();
    return output;
  })();

  inFlightTranslations.set(key, work);

  try {
    return await work;
  } finally {
    inFlightTranslations.delete(key);
  }
}

async function translateShortText(source, contextLabel, force = false) {
  if (!source || !/[A-Za-z]/.test(source)) {
    return source;
  }

  if (!shouldTranslateTextLiteral(source, { force })) {
    return source;
  }

  const instructions = `
Translate this short technical UI string from English to Korean.

Rules:
- Preserve product names, package names, file names, slugs, URLs, and code identifiers exactly.
- Preserve any placeholder token like ZXTERM0QZ or ZXINLINE0QZ exactly.
- Do not add quotes or commentary.
- Return only the translated string.
`;

  const glossaryProtected = protectGlossaryTerms(source);
  const translated = await translateCached(
    "short",
    glossaryProtected.protectedText,
    instructions,
    contextLabel,
  );
  return glossaryProtected.restore(translated);
}

async function translateExpressionStringLiterals(source, attrName, contextLabel) {
  if (SKIP_TRANSLATION_EXPR_ATTRS.has(attrName)) {
    return source;
  }

  let translated = "";
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];

    if (current === "'" || current === '"') {
      const end = findQuotedEnd(source, index, current);
      if (end === -1) {
        translated += source.slice(index);
        break;
      }

      const value = source.slice(index + 1, end);
      const nextValue = shouldTranslateTextLiteral(value)
        ? await translateShortText(value, `${contextLabel} literal`)
        : value;
      translated += `${current}${nextValue}${current}`;
      index = end;
      continue;
    }

    if (current === "`") {
      const end = findQuotedEnd(source, index, current);
      if (end === -1) {
        translated += source.slice(index);
        break;
      }

      translated += source.slice(index, end + 1);
      index = end;
      continue;
    }

    translated += current;
  }

  return translated;
}

async function translateTagSyntax(tag, contextLabel) {
  let output = "";

  for (let index = 0; index < tag.length; index += 1) {
    const match = /^[A-Za-z_:][-A-Za-z0-9_:]*/.exec(tag.slice(index));
    const previous = index === 0 ? "" : tag[index - 1];

    if (match && /[\s<{]/.test(previous)) {
      const attrName = match[0];
      const cursor = index + attrName.length;
      const next = tag[cursor];

      if (next === "=") {
        const marker = tag[cursor + 1];

        if (marker === "'" || marker === '"') {
          const end = findQuotedEnd(tag, cursor + 1, marker);
          if (end !== -1) {
            const value = tag.slice(cursor + 2, end);
            const translatedValue =
              TRANSLATABLE_STRING_ATTRS.has(attrName) &&
              shouldTranslateTextLiteral(value, { force: true })
                ? await translateShortText(
                    value,
                    `${contextLabel} attr:${attrName}`,
                    true,
                  )
                : value;
            output += `${attrName}=${marker}${translatedValue}${marker}`;
            index = end;
            continue;
          }
        }

        if (marker === "{") {
          const end = findMatchingBrace(tag, cursor + 1);
          if (end !== -1) {
            const expression = tag.slice(cursor + 2, end);
            const translatedExpression = await translateExpressionStringLiterals(
              expression,
              attrName,
              `${contextLabel} attr:${attrName}`,
            );
            output += `${attrName}={${translatedExpression}}`;
            index = end;
            continue;
          }
        }
      }
    }

    output += tag[index];
  }

  return output;
}

async function protectRichSyntax(source, contextLabel) {
  const tokens = [];
  let protectedText = "";

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "<" && looksLikeTagStart(source, index)) {
      const end = findTagEnd(source, index);
      if (end !== -1) {
        const rawTag = source.slice(index, end + 1);
        const tagName = /^<([A-Za-z][A-Za-z0-9_.-]*)/.exec(rawTag)?.[1];

        if (
          tagName &&
          PROTECTED_COMPONENT_BLOCKS.has(tagName) &&
          !rawTag.endsWith("/>")
        ) {
          const closeTag = `</${tagName}>`;
          const closeIndex = source.indexOf(closeTag, end + 1);
          if (closeIndex !== -1) {
            const token = `ZXTAG${tokens.length}QZ`;
            tokens.push(source.slice(index, closeIndex + closeTag.length));
            protectedText += token;
            index = closeIndex + closeTag.length - 1;
            continue;
          }
        }

        const localizedTag = await translateTagSyntax(
          rawTag,
          `${contextLabel} tag#${tokens.length}`,
        );
        const token = `ZXTAG${tokens.length}QZ`;
        tokens.push(localizedTag);
        protectedText += token;
        index = end;
        continue;
      }
    }

    if (source[index] === "{") {
      const end = findMatchingBrace(source, index);
      if (end !== -1) {
        const token = `ZXEXPR${tokens.length}QZ`;
        tokens.push(source.slice(index, end + 1));
        protectedText += token;
        index = end;
        continue;
      }
    }

    protectedText += source[index];
  }

  return {
    protectedText,
    restore(value) {
      return tokens.reduce(
        (current, token, tokenIndex) =>
          current
            .replaceAll(`ZXTAG${tokenIndex}QZ`, token)
            .replaceAll(`ZXEXPR${tokenIndex}QZ`, token),
        value,
      );
    },
  };
}

async function translateMdxFragment(source, contextLabel) {
  const instructions = `
Translate this MDX fragment from English to Korean.

Rules:
- Translate all natural-language prose to Korean.
- Keep Markdown and MDX syntax intact.
- Keep fenced code blocks unchanged.
- Keep import/export lines unchanged.
- Keep inline code, package names, file names, import paths, env variables, CLI flags, URLs, slugs, and API identifiers unchanged.
- Preserve any placeholder token like ZXTERM0QZ, ZXINLINE0QZ, ZXTAG0QZ, or ZXEXPR0QZ exactly.
- Preserve Markdown punctuation exactly, including **bold**, *italic*, headings, list markers, tables, and link syntax like [label](/path).
- Preserve ordering, headings, lists, tables, and spacing.
- Do not summarize, omit, or explain.
- Return only the translated fragment.
`;

  const glossaryProtected = protectGlossaryTerms(source);
  const translated = await translateCached(
    "fragment",
    glossaryProtected.protectedText,
    instructions,
    contextLabel,
  );
  return glossaryProtected.restore(translated);
}

async function translateMdxBody(source, contextLabel) {
  const segments = splitMdxBody(source);
  const translated = [];

  for (const segment of segments) {
    if (!shouldTranslateSegment(segment)) {
      translated.push(segment);
      continue;
    }

    const inlineProtected = protectInlineTokens(segment);
    const richProtected = await protectRichSyntax(
      inlineProtected.protectedText,
      `${contextLabel} body chunk`,
    );
    const output = await translateMdxFragment(
      richProtected.protectedText,
      `${contextLabel} body chunk`,
    );
    translated.push(inlineProtected.restore(richProtected.restore(output)));
  }

  return translated.join("\n");
}

async function translateMdxDocument(source, contextLabel) {
  const parsed = parseFrontmatter(source);
  const data = { ...parsed.data };

  if (typeof data.title === "string") {
    data.title = await translateShortText(data.title, `${contextLabel} title`, true);
  }
  if (typeof data.description === "string") {
    data.description = await translateShortText(
      data.description,
      `${contextLabel} description`,
      true,
    );
  }

  const content = await translateMdxBody(parsed.content, contextLabel);
  const rewritten = rewriteMdxImports(content);

  if (Object.keys(data).length === 0) {
    return rewritten.endsWith("\n") ? rewritten : `${rewritten}\n`;
  }

  return matter.stringify(rewritten, data);
}

async function ensureManifest() {
  if (!(await exists(MANIFEST_PATH))) {
    await ensureDir(TRANSLATION_DIR);
    const manifest = await buildDocsManifest();
    assertPinnedManifest(manifest);
    await writeJson(MANIFEST_PATH, manifest);
    return manifest;
  }

  const manifest = await readJson(MANIFEST_PATH);
  assertPinnedManifest(manifest);
  return manifest;
}

async function updateManifest(entries) {
  await writeJson(MANIFEST_PATH, entries);
}

async function syncKoreanMetaFiles() {
  const outputPaths = [
    path.join(DOCS_KO_DIR, "_meta.json"),
    path.join(DOCS_KO_DIR, "get-started", "_meta.json"),
    path.join(DOCS_KO_DIR, "guides", "_map.json"),
  ];

  if (
    !force &&
    (await Promise.all(outputPaths.map((outputPath) => exists(outputPath)))).every(Boolean)
  ) {
    return;
  }

  const rootMeta = await readJson(path.join(DOCS_DIR, "_meta.json"));
  const getStartedMeta = await readJson(path.join(DOCS_DIR, "get-started", "_meta.json"));
  const guideMap = await readJson(path.join(DOCS_DIR, "guides", "_map.json"));

  async function translateMetaValue(value, label) {
    if (typeof value === "string") {
      if (value === "---") {
        return value;
      }
      if (value.endsWith("::")) {
        return `${await translateShortText(value.slice(0, -2), label, true)}::`;
      }
      return translateShortText(value, label, true);
    }

    if (Array.isArray(value) && value.length === 2 && typeof value[0] === "string") {
      return [
        value[0],
        await translateShortText(value[1], `${label}:${value[0]}`, true),
      ];
    }

    return value;
  }

  const translatedRootMeta = [];
  for (const item of rootMeta) {
    translatedRootMeta.push(await translateMetaValue(item, "root-meta"));
  }

  const translatedGetStartedMeta = [];
  for (const item of getStartedMeta) {
    translatedGetStartedMeta.push(await translateMetaValue(item, "get-started-meta"));
  }

  const translatedGuideMap = [];
  for (const item of guideMap) {
    translatedGuideMap.push(await translateMetaValue(item, "guide-map"));
  }

  await writeText(outputPaths[0], `${JSON.stringify(translatedRootMeta, null, 2)}\n`);
  await writeText(outputPaths[1], `${JSON.stringify(translatedGetStartedMeta, null, 2)}\n`);
  await writeText(outputPaths[2], `${JSON.stringify(translatedGuideMap, null, 2)}\n`);
}

function localizeSupportAstro(relativePath, source) {
  let output = source.replaceAll('aria-label="Copy"', 'aria-label="복사"');

  if (relativePath === "Callout.astro") {
    output = output
      .replace('>{"IMPORTANT"}<', '>{"중요"}<')
      .replace('>{"WARNING"}<', '>{"경고"}<');
  }

  if (relativePath === "Prerequisites.astro") {
    output = output.replace(
      "This guide assumes familiarity with:",
      "이 문서는 다음 내용을 이미 알고 있다고 가정합니다:",
    );
  }

  if (relativePath === "Breadcrumbs.astro") {
    output = output
      .replaceAll("New database", "새 데이터베이스")
      .replaceAll("Existing database", "기존 데이터베이스")
      .replace("<div>Meet Drizzle</div>", "<div>Drizzle 시작하기</div>")
      .replace(">Get started<", ">시작하기<");
  }

  if (relativePath === "GetStartedLinks/index.astro") {
    output = output
      .replaceAll("New database", "새 데이터베이스")
      .replaceAll("Existing database", "기존 데이터베이스");
  }

  if (relativePath === "SupportingTable.astro") {
    output = output
      .replace(">Support<", ">지원 여부<")
      .replace(">Docs<", ">문서<")
      .replace(">Website<", ">웹사이트<");
  }

  if (relativePath === "WhatsNextPostgres.astro") {
    output = output
      .replace("title='Manage schema'", "title='스키마 관리'")
      .replace("title='Query data'", "title='데이터 조회'")
      .replace('["Drizzle Schema"', '["Drizzle 스키마"')
      .replace('["PostgreSQL data types"', '["PostgreSQL 데이터 타입"')
      .replace('["Indexes and Constraints"', '["인덱스와 제약 조건"')
      .replace('["Database Views"', '["데이터베이스 뷰"')
      .replace('["Database Schemas"', '["데이터베이스 스키마"')
      .replace('["Sequences"', '["시퀀스"')
      .replace('["Extensions"', '["확장 기능"')
      .replace('["Relational Queries"', '["관계형 쿼리"')
      .replace('["Select"', '["조회"')
      .replace('["Insert"', '["삽입"')
      .replace('["Update"', '["수정"')
      .replace('["Delete"', '["삭제"')
      .replace('["Filters"', '["필터"')
      .replace('["Joins"', '["조인"')
      .replace('["sql`` operator"', '["sql`` 연산자"');
  }

  if (relativePath === "WhatsNextMSSQL.astro") {
    output = output
      .replace("title='Manage schema'", "title='스키마 관리'")
      .replace("title='Query data'", "title='데이터 조회'")
      .replace('["Drizzle Schema"', '["Drizzle 스키마"')
      .replace('["MSSQL data types"', '["MSSQL 데이터 타입"')
      .replace('["Indexes and Constraints"', '["인덱스와 제약 조건"')
      .replace('["Database Views"', '["데이터베이스 뷰"')
      .replace('["Database Schemas"', '["데이터베이스 스키마"')
      .replace('["Select"', '["조회"')
      .replace('["Insert"', '["삽입"')
      .replace('["Update"', '["수정"')
      .replace('["Delete"', '["삭제"')
      .replace('["Filters"', '["필터"')
      .replace('["Joins"', '["조인"')
      .replace('["sql`` operator"', '["sql`` 연산자"');
  }

  return output.replaceAll("@mdx/", "@mdx-ko/");
}

async function syncMdxKoLayer() {
  const supportFiles = await walkFiles(
    MDX_DIR,
    (value) =>
      value.endsWith(".astro") || value.endsWith(".mdx") || value.endsWith(".ts"),
  );

  for (const supportFile of supportFiles) {
    const relativePath = relativeFrom(MDX_DIR, supportFile);
    const outputPath = path.join(MDX_KO_DIR, relativePath);
    if (!force && (await exists(outputPath))) {
      continue;
    }

    const source = await readText(supportFile);
    let output = source;

    if (relativePath.endsWith(".mdx")) {
      output = await translateMdxDocument(source, `mdx-ko/${relativePath}`);
    } else if (relativePath.endsWith(".astro")) {
      output = localizeSupportAstro(relativePath, source);
    }

    if (relativePath.endsWith(".ts")) {
      output = output.replaceAll("GetStartedItems", "GetStartedItems");
    }

    await writeText(outputPath, output);
    console.log(`synced mdx-ko/${relativePath}`);
  }
}

function guidesKoComponent() {
  return `---
import guideMap from "@/content/docs-ko/guides/_map.json";

const guides = await Astro.glob("../../content/docs-ko/guides/*.mdx");
const sortedGuides = [];

guideMap.forEach((key) => {
  const item = guides.find((guide) => (guide.frontmatter.slug ?? guide.file?.split("/").at(-1)?.replace(/\\.mdx$/, "")) === key[0]);
  if (item) sortedGuides.push(item);
});
---

<div class="guides_title">가이드</div>
<div class="guides_description">
  자주 쓰는 작업을 단계별로 따라갈 수 있도록 정리한 코드 예제와 실전 안내 모음입니다.
</div>
<div class="guides__items">
  {
    sortedGuides.map((guide) => (
      <div class="guides__item">
        <a class="guides__item_link" href={\`/docs/guides/\${guide.frontmatter.slug ?? ""}\`}>
          {guide.frontmatter.title}
        </a>
      </div>
    ))
  }
</div>

<style>
  html.dark .guides_title {
    color: #e2e6f0;
  }

  .guides_title {
    color: #0f172a;
    margin-top: 8px;
    font-size: 32px;
    font-weight: 700;
    line-height: 48px;
    letter-spacing: -0.48px;
  }

  html.dark .guides_description {
    color: #f3f4f6;
  }

  .guides_description {
    color: #1e1e1e;
    font-size: 16px;
    font-weight: 400;
    letter-spacing: -0.176px;
    margin-top: 8px;
    line-height: 150%;
    opacity: 0.7;
    margin-bottom: 16px;
  }

  .guides__items {
    display: flex;
    flex-direction: column;
  }

  html.dark .guides__item:not(:last-child) {
    border-bottom: 1px solid #262626;
  }

  .guides__item:not(:last-child) {
    border-bottom: 1px solid #efefef;
  }

  .guides__item {
    padding: 8px 0;
  }

  html.dark .guides__item_link {
    color: #e2e6f0;
  }

  .guides__item_link {
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 1px;
  }
</style>
`;
}

function tutorialsKoComponent() {
  return `---
const tutorials = await Astro.glob("../../content/docs-ko/tutorials/**/*.mdx");

const formattedTutorials = tutorials.map((tutorial) => ({
  ...tutorial,
  slug: tutorial.file.split("/").at(-1)?.replace(/\\.mdx$/, ""),
}));
---

<div class="learn__title-block">
  <div class="tutorials_title">튜토리얼</div>
</div>
<div class="tutorials__items">
  {
    formattedTutorials.map((tutorial) => (
      <div class="tutorials__item">
        <a class="tutorials__item_link" href={\`/docs/tutorials/\${tutorial.slug}\`}>
          {tutorial.frontmatter.title}
        </a>
      </div>
    ))
  }
</div>

<style>
  .tutotials__section {
    display: flex;
    flex-direction: column;
    margin-top: 24px;
    margin-bottom: 32px;
  }

  html.dark .tutorials_title {
    color: #c8c9ca;
  }

  .tutorials_title {
    color: #0f172a;
    margin-top: 8px;
    font-size: 32px;
    font-weight: 700;
    line-height: 48px;
    letter-spacing: -0.48px;
    margin-bottom: 16px;
  }

  .tutorials__items {
    display: flex;
    flex-direction: column;
  }

  html.dark .tutorials__item:not(:last-child) {
    border-bottom: 1px solid #262626;
  }

  .tutorials__item:not(:last-child) {
    border-bottom: 1px solid #efefef;
  }

  .tutorials__item {
    padding: 8px 0;
  }

  html.dark .tutorials__item_link {
    color: #e2e6f0;
  }

  .tutorials__item_link {
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 1px;
  }

  .learn__title-block {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex-shrink: 0;
  }
</style>
`;
}

function latestReleasesKoComponent() {
  return `---
const articles = await Astro.glob("../../content/docs-ko/latest-releases/*.mdx");

const filteredArticles = articles.sort(
  (a, b) =>
    new Date(b.frontmatter.pubDate).getTime() - new Date(a.frontmatter.pubDate).getTime(),
);

const options = {
  year: "numeric",
  month: "short",
  day: "numeric",
};
---

<div class="learn__title-block">
  <div class="latest-releases_title">최신 릴리스</div>
</div>
<div class="latest-updates__cards">
  {
    filteredArticles.map((update) => (
      <a href={\`/docs/\${update.file.split("src/content/docs-ko/").at(-1)?.replace(/\\.mdx$/, "")}\`} class="latest-updates__card">
        <div class="latest-updates__card_title">{update.frontmatter.title}</div>
        <div class="latest-updates__card_date">
          {new Date(update.frontmatter.pubDate).toLocaleDateString("ko-KR", options)}
        </div>
        <div class="latest-updates__card_description">{update.frontmatter.description}</div>
        <div class="latest-updates__card_link">더 읽기</div>
      </a>
    ))
  }
</div>

<style>
  html.dark .latest-releases_title {
    color: #c8c9ca;
  }

  .latest-releases_title {
    color: #0f172a;
    font-size: 32px;
    font-weight: 700;
    line-height: 48px;
    letter-spacing: -0.48px;
    margin-bottom: 16px;
    margin-top: 8px;
  }

  .latest-updates__cards {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 24px;
    width: 100%;
  }

  html.dark .latest-updates__card {
    background-color: #171717;
    border: 1px solid #303030;
  }

  .latest-updates__card {
    padding: 24px;
    border-radius: 8px;
    border: 1px solid #e6e6e6;
    background: #fff;
    line-height: normal;
    text-decoration: none;
  }

  html.dark .latest-updates__card_title {
    color: #c8c9ca;
  }

  .latest-updates__card_title {
    color: #222124;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.198px;
  }

  html.dark .latest-updates__card_date {
    color: #c4c5c6;
  }

  .latest-updates__card_date {
    color: #7e868c;
    font-size: 12px;
    font-weight: 400;
    letter-spacing: -0.132px;
    margin-top: 8px;
  }

  html.dark .latest-updates__card_description {
    color: #c4c5c6;
  }

  .latest-updates__card_description {
    color: #5f5f61;
    font-size: 16px;
    font-weight: 400;
    letter-spacing: -0.176px;
    margin-top: 16px;
  }

  .learn__title-block {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex-shrink: 0;
  }

  .latest-updates__card_link {
    display: none;
  }
</style>
`;
}

async function syncKoreanUiComponents() {
  await writeText(path.join(UI_COMPONENTS_KO_DIR, "Guides.astro"), guidesKoComponent());
  await writeText(
    path.join(UI_COMPONENTS_KO_DIR, "Tutorials.astro"),
    tutorialsKoComponent(),
  );
  await writeText(
    path.join(UI_COMPONENTS_KO_DIR, "LatestReleases.astro"),
    latestReleasesKoComponent(),
  );
}

async function translateDocs(manifest) {
  const queue = [];
  let selected = 0;

  for (const entry of manifest) {
    if (filter && !entry.sourcePath.includes(filter) && !entry.outputPath.includes(filter)) {
      continue;
    }

    if (limit !== null && selected >= limit) {
      break;
    }

    selected += 1;
    const outputPath = path.join(ROOT, entry.outputPath);
    if (!force && (await exists(outputPath))) {
      entry.status = "translated";
      continue;
    }

    queue.push(entry);
  }

  await updateManifest(manifest);

  let completed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const currentIndex = cursor;
      cursor += 1;
      const entry = queue[currentIndex];
      const source = await readText(path.join(ROOT, entry.sourcePath));
      const translated = await translateMdxDocument(source, entry.sourcePath);
      await writeText(path.join(ROOT, entry.outputPath), translated);
      entry.status = "translated";
      completed += 1;
      console.log(`[${completed}/${queue.length}] translated ${entry.outputPath}`);
      await updateManifest(manifest);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, queue.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

await ensureDir(TRANSLATION_DIR);
await loadCache();
const manifest = await ensureManifest();

console.log(
  `provider=${provider} model=${model} concurrency=${concurrency} maxChars=${maxChars}`,
);
if (!skipMeta) {
  await syncKoreanMetaFiles();
}
if (!skipMdxLayer) {
  await syncMdxKoLayer();
}
if (!skipUiComponents) {
  await syncKoreanUiComponents();
}
if (!skipDocs) {
  await translateDocs(manifest);
}
await flushCache(true);
if (argosProcess) {
  argosProcess.kill();
}
