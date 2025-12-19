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
  if (!fs.existsSync(dir)) return true;
  const trash = `${dir}.__trash__${Date.now()}`;
  fs.renameSync(dir, trash);
  return true;
}

function tryRemove(dir) {
  if (!fs.existsSync(dir)) return true;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

let lastErr;
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    // Prefer rename: OpenNext only needs `.open-next` to be absent so it can recreate it.
    // Renaming often succeeds even when deleting fails due to transient Windows locks.
    tryRenameOutOfTheWay(target);

    // Best-effort cleanup: if the folder wasn't renamed (or rename isn't supported), remove it.
    tryRemove(target);
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


