import { assertPinnedManifest, buildDocsManifest, MANIFEST_PATH, writeJson } from "./_lib.mjs";

const manifest = await buildDocsManifest();
assertPinnedManifest(manifest);
await writeJson(MANIFEST_PATH, manifest);

const publicCount = manifest.filter((entry) => entry.isPublic).length;
const sourceOnlyCount = manifest.length - publicCount;

console.log(
  `Wrote ${manifest.length} manifest entries to ${MANIFEST_PATH} (${publicCount} public, ${sourceOnlyCount} source-only)`,
);
