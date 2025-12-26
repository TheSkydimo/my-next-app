import { spawn } from "node:child_process";
import fs from "node:fs";

const MAX_ATTEMPTS = Number.parseInt(process.env.NEXT_BUILD_RETRY_MAX ?? "3", 10) || 3;
const RETRY_DELAY_MS = Number.parseInt(process.env.NEXT_BUILD_RETRY_DELAY_MS ?? "1200", 10) || 1200;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldRetryFromOutput(output) {
  const s = String(output ?? "");
  // Windows 上偶发：Next 在 “Collecting page data” 阶段报 ENOENT / PageNotFoundError
  // 典型错误：
  // - PageNotFoundError: Cannot find module for page: /_document
  // - PageNotFoundError: Cannot find module for page: /admin/users/[email]
  // - ENOENT: no such file or directory, open '.next\\server\\...\\.nft.json'
  return (
    s.includes("PageNotFoundError") ||
    s.includes("Cannot find module for page:") ||
    // Windows race: prerender/export tries to require a .next build artifact that wasn't written yet
    // e.g. "Cannot find module '...\\.next\\server\\pages\\404.js'" while prerendering /404
    (s.includes("Cannot find module") &&
      (s.includes(".next\\server\\pages\\") || s.includes(".next/server/pages/")) &&
      (s.includes("prerendering page") || s.includes("Export encountered an error"))) ||
    (s.includes("ENOENT") && s.includes(".next")) ||
    s.includes("Failed to collect page data")
  );
}

function cleanNextDir() {
  try {
    fs.rmSync(".next", { recursive: true, force: true });
  } catch {
    // ignore
  }
}

async function runOnce() {
  return await new Promise((resolve) => {
    const child = spawn("next", ["build"], {
      shell: true, // Windows compatibility
      env: process.env,
    });

    let output = "";

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
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Windows 上遇到 flaky build 时，保守做法是每次尝试前都清空 .next，避免半成品导致后续更奇怪的报错
    cleanNextDir();

    const { code, output } = await runOnce();
    if (code === 0) process.exit(0);

    const retryable = shouldRetryFromOutput(output);
    if (!retryable || attempt === MAX_ATTEMPTS) {
      process.exit(code || 1);
    }

    console.warn(
      `\n[retry-next-build] Detected flaky Next build error (likely Windows filesystem race). ` +
        `Retrying ${attempt}/${MAX_ATTEMPTS} in ${RETRY_DELAY_MS}ms...\n`
    );
    await sleep(RETRY_DELAY_MS);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


