import fs from "node:fs";

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
  console.error(
    `Failed to remove ${target}. If you're on Windows, close any Explorer window opened in the project folder and temporarily disable AV scanning for this directory.`
  );
  throw lastErr;
}


