import fs from "node:fs";
import path from "node:path";

function fail(message) {
  return { level: "fail", message };
}

function warn(message) {
  return { level: "warn", message };
}

function ok(message) {
  return { level: "ok", message };
}

function mask(v) {
  if (!v) return "";
  const s = String(v);
  if (s.length <= 8) return "***";
  return `${s.slice(0, 3)}***${s.slice(-3)}`;
}

function stripJsonc(input) {
  // Minimal JSONC stripper: removes // and /**/ comments.
  // Good enough for wrangler.jsonc in this repo.
  const noBlock = input.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLine = noBlock.replace(/(^|[^:\\])\/\/.*$/gm, "$1");
  return noLine;
}

function readJsoncFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const stripped = stripJsonc(raw);
  return JSON.parse(stripped);
}

function isStrongSessionSecret(secret) {
  const s = String(secret ?? "").trim();
  if (!s) return { ok: false, reason: "missing" };
  if (s.startsWith("dev-")) return { ok: false, reason: "dev_prefix" };
  if (s.length < 32) return { ok: false, reason: "too_short" };
  if (/\s/.test(s)) return { ok: false, reason: "contains_whitespace" };
  return { ok: true };
}

function run() {
  const results = [];
  const nodeEnv = String(process.env.NODE_ENV ?? "");
  const nextjsEnv = String(process.env.NEXTJS_ENV ?? "");

  // 1) NODE_ENV must be production for real deployments.
  if (nodeEnv !== "production") {
    results.push(
      warn(
        `NODE_ENV is "${nodeEnv || "(unset)"}". For real deployments, ensure NODE_ENV="production".`
      )
    );
  } else {
    results.push(ok(`NODE_ENV is "production".`));
  }

  // 1) (extra) NEXTJS_ENV should not be "development" in prod.
  if (nextjsEnv === "development") {
    results.push(
      fail(
        `NEXTJS_ENV is "development". This must NOT be enabled in production (dev-only helpers would become eligible).`
      )
    );
  } else {
    results.push(ok(`NEXTJS_ENV is "${nextjsEnv || "(unset)"}".`));
  }

  // 2) Seed must be disabled in prod.
  if (String(process.env.ALLOW_ADMIN_SEED ?? "") === "true") {
    results.push(
      fail(
        `ALLOW_ADMIN_SEED="true" detected. This must be disabled in production (seed endpoint should be unreachable).`
      )
    );
  } else {
    results.push(ok(`ALLOW_ADMIN_SEED is not enabled.`));
  }

  // 3) Dev helpers must be disabled in prod.
  const devBypass = String(process.env.DEV_BYPASS_TURNSTILE ?? "");
  const devReturn = String(process.env.DEV_RETURN_EMAIL_CODE ?? "");
  if (devBypass === "1") {
    results.push(
      fail(
        `DEV_BYPASS_TURNSTILE="1" detected. This must NOT be enabled in production.`
      )
    );
  } else {
    results.push(ok(`DEV_BYPASS_TURNSTILE is not enabled.`));
  }
  if (devReturn === "1") {
    results.push(
      fail(
        `DEV_RETURN_EMAIL_CODE="1" detected. This must NOT be enabled in production (email codes would leak via API).`
      )
    );
  } else {
    results.push(ok(`DEV_RETURN_EMAIL_CODE is not enabled.`));
  }

  // 4) SESSION_SECRET must be set and strong in prod.
  const sessionSecret = process.env.SESSION_SECRET;
  const strong = isStrongSessionSecret(sessionSecret);
  if (!strong.ok) {
    results.push(
      fail(
        `SESSION_SECRET is not safe (${strong.reason}). Provide a strong random secret (>=32 chars, no "dev-" prefix). Current: ${mask(
          sessionSecret
        )}`
      )
    );
  } else {
    results.push(ok(`SESSION_SECRET looks present and strong.`));
  }

  // 5) HTTPS check cannot be fully validated offline, but we can sanity check config.
  results.push(
    warn(
      `HTTPS cannot be validated offline. Ensure Cloudflare/Proxy sets correct headers (CF-Visitor / X-Forwarded-Proto) so cookies get "Secure" and redirects use https.`
    )
  );

  // Optional: warn if wrangler.jsonc contains obviously risky vars in non-dev env.
  // This is best-effort; do not hard-fail based on file parsing.
  try {
    const repoRoot = process.cwd();
    const wranglerPath = path.join(repoRoot, "wrangler.jsonc");
    if (fs.existsSync(wranglerPath)) {
      const cfg = readJsoncFile(wranglerPath);
      const rootVars = cfg?.vars ?? {};
      const hasRisky =
        rootVars.ALLOW_ADMIN_SEED === "true" ||
        rootVars.DEV_BYPASS_TURNSTILE === "1" ||
        rootVars.DEV_RETURN_EMAIL_CODE === "1";
      if (hasRisky) {
        results.push(
          warn(
            `wrangler.jsonc root "vars" contains dev-only flags. Make sure these flags are ONLY present under env.development.`
          )
        );
      } else {
        results.push(ok(`wrangler.jsonc root vars do not include obvious dev-only flags.`));
      }
    }
  } catch (e) {
    results.push(
      warn(
        `Could not parse wrangler.jsonc for extra checks (non-fatal): ${
          e instanceof Error ? e.message : String(e)
        }`
      )
    );
  }

  return results;
}

const results = run();
const failed = results.some((r) => r.level === "fail");

for (const r of results) {
  const prefix = r.level === "ok" ? "[OK]" : r.level === "warn" ? "[WARN]" : "[FAIL]";
  // eslint-disable-next-line no-console
  console.log(`${prefix} ${r.message}`);
}

if (failed) {
  // eslint-disable-next-line no-console
  console.error("\nSecurity preflight failed. Fix the [FAIL] items before deployment.");
  process.exit(1);
} else {
  // eslint-disable-next-line no-console
  console.log("\nSecurity preflight passed (warnings may still require review).");
}


