import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

import {
  ROOT,
  UPSTREAM_CACHE_DIR,
  UPSTREAM_COMMIT,
  UPSTREAM_REPO_URL,
  ensureDir,
  exists,
  parseArgs,
} from "./_lib.mjs";

const execFile = promisify(execFileCallback);
const args = parseArgs(process.argv.slice(2));
const repoDir = path.join(UPSTREAM_CACHE_DIR, "drizzle-orm-docs");

async function git(...gitArgs) {
  return execFile("git", gitArgs, { cwd: repoDir });
}

await ensureDir(UPSTREAM_CACHE_DIR);

if (!(await exists(repoDir))) {
  await execFile("git", ["clone", "--no-checkout", UPSTREAM_REPO_URL, repoDir], {
    cwd: ROOT,
  });
}

await git("fetch", "--depth", "1", "origin", UPSTREAM_COMMIT);
await git("checkout", "--force", UPSTREAM_COMMIT);

if (args["refresh-root"]) {
  console.log(
    "Upstream cache refreshed. Root refresh is intentionally manual to avoid overwriting translated files.",
  );
} else {
  console.log(`Upstream cache ready at ${repoDir} (${UPSTREAM_COMMIT})`);
}
