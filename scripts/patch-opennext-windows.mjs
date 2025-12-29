import fs from "node:fs";
import path from "node:path";

/**
 * OpenNext (via @opennextjs/aws) deletes the output dir using `fs.rmSync(..., { recursive, force })`.
 * On Windows this can intermittently fail with EBUSY/EPERM due to AV/indexer locks.
 *
 * Node supports built-in retry options for rmSync, so we patch OpenNext to use them.
 * This file is applied via `postinstall` so it survives fresh installs/CI.
 */

const targetFile = path.join(
  process.cwd(),
  "node_modules",
  "@opennextjs",
  "aws",
  "dist",
  "build",
  "helper.js"
);

if (!fs.existsSync(targetFile)) {
  // Nothing to patch (e.g. deps not installed yet).
  process.exit(0);
}

const original = fs.readFileSync(targetFile, "utf8");

const fromLegacy =
  "fs.rmSync(options.outputDir, { recursive: true, force: true });";
const fromRetries =
  "fs.rmSync(options.outputDir, { recursive: true, force: true, maxRetries: 30, retryDelay: 200 });";
const to =
  "try { fs.rmSync(options.outputDir, { recursive: true, force: true, maxRetries: 30, retryDelay: 200 }); } catch (e) { const code = e && typeof e === 'object' ? e.code : undefined; if (code === 'EBUSY' || code === 'EPERM' || code === 'ENOTEMPTY') { logger.warn(`[patch-opennext-windows] Windows lock (${code}) while cleaning outputDir; continuing with existing directory.`); } else { throw e; } }";

if (
  !original.includes(fromLegacy) &&
  !original.includes(fromRetries) &&
  !original.includes(to)
) {
  console.warn(
    `[patch-opennext-windows] Skipped: expected snippet not found in ${targetFile}`
  );
  process.exit(0);
}

const patched = original.includes(to)
  ? original
  : original.includes(fromRetries)
    ? original.replace(fromRetries, to)
    : original.replace(fromLegacy, to);
fs.writeFileSync(targetFile, patched, "utf8");
console.log("[patch-opennext-windows] Patched OpenNext rmSync retries for Windows.");


