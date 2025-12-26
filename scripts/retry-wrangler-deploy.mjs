import { spawn } from "node:child_process";

const MAX_ATTEMPTS = Number.parseInt(process.env.WRANGLER_DEPLOY_RETRY_MAX ?? "4", 10) || 4;
const RETRY_DELAY_MS = Number.parseInt(process.env.WRANGLER_DEPLOY_RETRY_DELAY_MS ?? "2500", 10) || 2500;

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
    s.includes("code: 100312")
  );
}

async function runOnce(args) {
  return await new Promise((resolve) => {
    const child = spawn("wrangler", args, {
      shell: true, // Windows compatibility
      env: process.env,
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

    console.warn(
      `\n[retry-wrangler-deploy] Detected Cloudflare transient deploy failure (7010/100312). ` +
        `Retrying ${attempt}/${MAX_ATTEMPTS} in ${RETRY_DELAY_MS}ms...\n`
    );
    await sleep(RETRY_DELAY_MS);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


