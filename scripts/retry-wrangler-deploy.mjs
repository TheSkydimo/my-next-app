import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const MAX_ATTEMPTS = Number.parseInt(process.env.WRANGLER_DEPLOY_RETRY_MAX ?? "6", 10) || 6;
const RETRY_DELAY_MS = Number.parseInt(process.env.WRANGLER_DEPLOY_RETRY_DELAY_MS ?? "2500", 10) || 2500;
const RETRY_DELAY_MAX_MS = Number.parseInt(process.env.WRANGLER_DEPLOY_RETRY_DELAY_MAX_MS ?? "30000", 10) || 30000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableWranglerError(output) {
  const s = String(output ?? "");
  // From observed logs:
  // - Cloudflare API transient 503: "Service unavailable [code: 7010]"
  // - Follow-up 400: "Completion token has already been consumed [code: 100312]"
  return (
    s.includes("Service unavailable [code: 7010]") ||
    s.includes("Completion token has already been consumed [code: 100312]") ||
    s.includes("code: 7010") ||
    s.includes("code: 100312") ||
    // Common transient network failures (especially on Windows): undici/Node fetch errors
    s.includes("TypeError: fetch failed") ||
    s.includes("fetch failed") ||
    s.includes("ECONNRESET") ||
    s.includes("ETIMEDOUT") ||
    s.includes("ENOTFOUND") ||
    s.includes("EAI_AGAIN") ||
    s.includes("socket hang up") ||
    s.includes("Client network socket disconnected")
  );
}

function withIpv4FirstNodeOptions(env) {
  const nextEnv = { ...env };
  const existing = String(nextEnv.NODE_OPTIONS ?? "");
  const flag = "--dns-result-order=ipv4first";
  if (!existing.includes(flag)) {
    nextEnv.NODE_OPTIONS = existing ? `${existing} ${flag}` : flag;
  }
  // Wrangler has built-in OpenNext auto-detection: when it sees an OpenNext project,
  // it will delegate `wrangler deploy` to `opennextjs-cloudflare deploy` unless this
  // env var is set. On Windows, that delegated flow can intermittently fail due to
  // temp/bundling path issues (e.g. missing `.wrangler/tmp/**/middleware-loader.entry.ts`)
  // even though the already-built `.open-next/worker.js` can be deployed successfully.
  //
  // Setting this prevents the extra delegation step and keeps deploy stable & noise-free.
  nextEnv.OPEN_NEXT_DEPLOY ??= "true";
  return nextEnv;
}

function parseWranglerEnvFromArgs(args) {
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i] ?? "");
    if (a.startsWith("--env=")) return a.slice("--env=".length).trim() || null;
    if (a === "--env") {
      const v = String(args[i + 1] ?? "").trim();
      return v || null;
    }
  }
  return null;
}

function parseDotenvLike(text) {
  const out = {};
  const lines = String(text ?? "").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (!key) continue;

    // Strip simple quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function loadLocalEnvForWrangler(args) {
  // Goal: make non-interactive `wrangler deploy` work by loading CLOUDFLARE_API_TOKEN
  // from gitignored env files, without hardcoding any secret into the repo.
  if (process.env.CLOUDFLARE_API_TOKEN) return;

  const projectRoot = process.cwd();
  const wranglerEnv = parseWranglerEnvFromArgs(args);

  const candidates = [
    // Common local-only files (gitignored)
    ".env.local",
    wranglerEnv ? `.env.${wranglerEnv}.local` : null,
    // Fallbacks (also typically gitignored in this repo)
    wranglerEnv ? `.env.${wranglerEnv}` : null,
    ".env",
  ].filter(Boolean);

  for (const rel of candidates) {
    const p = path.join(projectRoot, rel);
    try {
      const content = await fs.readFile(p, "utf8");
      const parsed = parseDotenvLike(content);
      const token = String(parsed.CLOUDFLARE_API_TOKEN ?? "").trim();
      if (token) {
        process.env.CLOUDFLARE_API_TOKEN = token;
        return;
      }
    } catch {
      // ignore missing/unreadable files
    }
  }
}

async function runOnce(args) {
  return await new Promise((resolve) => {
    const child = spawn("wrangler", args, {
      shell: true, // Windows compatibility
      // Helps with Windows networks where IPv6 DNS resolution can cause long hangs/timeouts
      env: withIpv4FirstNodeOptions(process.env),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let output = "";

    // In non-interactive runs Wrangler may still prompt; answer "y" once.
    child.stdin.write("y\n");
    child.stdin.end();

    child.stdout.on("data", (d) => {
      const s = d.toString();
      output += s;
      process.stdout.write(s);
    });
    child.stderr.on("data", (d) => {
      const s = d.toString();
      output += s;
      process.stderr.write(s);
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1, output });
    });
  });
}

async function suppressDevVarsForDeploy() {
  const projectRoot = process.cwd();
  const devVarsPath = path.join(projectRoot, ".dev.vars");
  const backupPath = path.join(projectRoot, ".dev.vars.__deploy_backup__");

  try {
    await fs.stat(devVarsPath);
  } catch {
    return {
      restore: async () => undefined,
    };
  }

  // If a previous run crashed, try to restore first.
  try {
    await fs.stat(backupPath);
    // If both exist, prefer keeping the current `.dev.vars` and remove the stale backup.
    await fs.rm(backupPath, { force: true });
  } catch {
    // ignore
  }

  // Temporarily move `.dev.vars` out of the way so Wrangler/OpenNext won't inject
  // local secrets into a production deploy. (Wrangler may auto-load `.dev.vars`
  // even for `deploy` in some setups.)
  await fs.rename(devVarsPath, backupPath);

  return {
    restore: async () => {
      try {
        await fs.rename(backupPath, devVarsPath);
      } catch {
        // ignore
      }
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  // Default command if none provided
  const finalArgs = args.length > 0 ? args : ["deploy"];

  // Ensure auth env is available for non-interactive runs (Cursor/CI).
  await loadLocalEnvForWrangler(finalArgs);

  const { restore } = await suppressDevVarsForDeploy();
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const { code, output } = await runOnce(finalArgs);
      if (code === 0) process.exit(0);

      const retryable = isRetryableWranglerError(output);
      if (!retryable || attempt === MAX_ATTEMPTS) {
        process.exit(code || 1);
      }

      const jitter = Math.floor(Math.random() * 250);
      const backoff = Math.min(RETRY_DELAY_MS * Math.pow(2, attempt - 1), RETRY_DELAY_MAX_MS);
      const delay = backoff + jitter;
      console.warn(
        `\n[retry-wrangler-deploy] Detected Cloudflare transient deploy failure (7010/100312). ` +
          `Retrying ${attempt}/${MAX_ATTEMPTS} in ${delay}ms...\n`
      );
      await sleep(delay);
    }
  } finally {
    await restore();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


