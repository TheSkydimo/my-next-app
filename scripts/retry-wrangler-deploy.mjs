import { spawn } from "node:child_process";

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
  return nextEnv;
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

async function main() {
  const args = process.argv.slice(2);
  // Default command if none provided
  const finalArgs = args.length > 0 ? args : ["deploy"];

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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


