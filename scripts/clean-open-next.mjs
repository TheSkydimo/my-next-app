import fs from "node:fs";
import path from "node:path";

function sleep(ms) {
  // Synchronous sleep to keep this script simple and cross-platform.
  const sab = new SharedArrayBuffer(4);
  const ia = new Int32Array(sab);
  Atomics.wait(ia, 0, 0, ms);
}

const target = ".open-next";
const maxAttempts = 25;
const baseDelayMs = 120;

function tryRenameOutOfTheWay(dir) {
  if (!fs.existsSync(dir)) return { renamed: false, trash: null };
  const trash = `${dir}.__trash__${Date.now()}`;
  try {
    fs.renameSync(dir, trash);
    return { renamed: true, trash };
  } catch (e) {
    return { renamed: false, trash: null, error: e };
  }
}

function tryRemove(dir) {
  if (!fs.existsSync(dir)) return true;
  // Node supports built-in retry options for transient Windows locks.
  fs.rmSync(dir, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
  return true;
}

let lastErr;
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    // Prefer rename: OpenNext only needs `.open-next` to be absent so it can recreate it.
    // Renaming often succeeds even when deleting fails due to transient Windows locks.
    const renameResult = tryRenameOutOfTheWay(target);

    // If rename worked, delete the renamed directory best-effort. If rename failed, try deleting in place.
    if (renameResult.renamed && renameResult.trash) {
      tryRemove(renameResult.trash);
    } else {
      tryRemove(target);
    }
    lastErr = undefined;
    break;
  } catch (e) {
    lastErr = e;
    const code = e && typeof e === "object" ? e.code : undefined;
    // Windows sometimes temporarily locks files (AV/indexer). Retry on common transient codes.
    if (code === "EBUSY" || code === "EPERM" || code === "ENOTEMPTY") {
      sleep(baseDelayMs * attempt);
      continue;
    }
    break;
  }
}

if (lastErr) {
  const code = lastErr && typeof lastErr === "object" ? lastErr.code : undefined;
  // On Windows, `.open-next/assets` may be locked by:
  // - running wrangler/workerd preview
  // - antivirus/indexer
  // - file explorer preview pane
  // In these cases, failing hard breaks deploy even though OpenNext can often proceed by reusing the directory.
  if (code === "EBUSY" || code === "EPERM" || code === "ENOTEMPTY") {
    console.warn(
      `[clean-open-next] Warning: failed to remove ${target} due to Windows file locks (${code}). ` +
        `Trying partial cleanup (keep assets/) and continuing anyway.`
    );

    // Best-effort partial cleanup to avoid stale files causing build errors
    // (e.g. duplicated exports in `.open-next/cloudflare/next-env.mjs`).
    try {
      if (fs.existsSync(target)) {
        const preserve = new Set(["assets"]);
        const entries = fs.readdirSync(target, { withFileTypes: true });
        for (const ent of entries) {
          if (preserve.has(ent.name)) continue;
          const p = path.join(target, ent.name);
          try {
            fs.rmSync(p, {
              recursive: true,
              force: true,
              maxRetries: 10,
              retryDelay: 100,
            });
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }

    process.exit(0);
  }

  console.error(`Failed to remove ${target}.`);
  throw lastErr;
}


