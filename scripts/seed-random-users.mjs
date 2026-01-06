/**
 * Seed random users into Cloudflare D1 for admin UI testing.
 *
 * Usage (PowerShell):
 *   npm run seed:users -- --env staging --count 40 --remote
 *
 * Notes:
 * - Inserts into `users` table only. No passwords/codes are created.
 * - Emails are unique (timestamp + random suffix) to avoid UNIQUE constraint conflicts.
 * - Intended for dev/staging only. Do NOT run against production unless you really want test data.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const out = {
    env: "development", // development | staging | production
    count: 40,
    remote: false,
    db: null, // override D1 database name
    vipRatio: 0, // 0..1
    adminRatio: 0, // 0..1 (kept 0 by default)
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--env") out.env = String(argv[++i] ?? "");
    else if (a === "--count") out.count = Number(argv[++i] ?? 40);
    else if (a === "--remote") out.remote = true;
    else if (a === "--local") out.remote = false;
    else if (a === "--db") out.db = String(argv[++i] ?? "");
    else if (a === "--vipRatio") out.vipRatio = Number(argv[++i] ?? 0);
    else if (a === "--adminRatio") out.adminRatio = Number(argv[++i] ?? 0);
    else if (a === "--help" || a === "-h") out.help = true;
  }

  return out;
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function pickDbName(env) {
  // Keep consistent with wrangler.jsonc.
  if (env === "staging") return "my_user_db_staging";
  if (env === "production") return "my_user_db";
  return "my_user_db";
}

function pickWranglerBin() {
  // Use local wrangler installed in node_modules (preferred).
  const bin = process.platform === "win32" ? "wrangler.cmd" : "wrangler";
  return path.resolve(process.cwd(), "node_modules", ".bin", bin);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      // Windows: spawning `.cmd` without a shell can throw EINVAL.
      // Use the system shell on win32 so `wrangler.cmd` works reliably.
      shell: process.platform === "win32",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed: ${cmd} ${args.join(" ")} (exit ${code})`));
    });
  });
}

function randomNumericUsername() {
  // Similar to existing production-ish pattern in screenshots: all digits.
  // 9..11 digits.
  const len = 9 + Math.floor(Math.random() * 3);
  let s = "";
  for (let i = 0; i < len; i++) s += String(Math.floor(Math.random() * 10));
  return s;
}

function randomEmail(uniquePrefix, i) {
  const suffix = crypto.randomBytes(4).toString("hex");
  // Use a reserved domain to avoid accidentally emailing real users.
  // Note: these users are only for admin UI list testing.
  return `test+${uniquePrefix}-${i}-${suffix}@example.test`;
}

function toIsoZ(d) {
  return new Date(d).toISOString();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(`
Seed random users (admin UI testing only)

Usage:
  npm run seed:users -- --env staging --count 40 --remote

Options:
  --env <development|staging|production>   Target env (default: development)
  --count <n>                              Number of users (default: 40)
  --remote                                Use Cloudflare remote D1 (recommended for staging/prod)
  --local                                 Use local D1 (default for development)
  --db <database_name>                     Override D1 database name (advanced)
  --vipRatio <0..1>                        Ratio of VIP users (default: 0)
  --adminRatio <0..1>                      Ratio of admin users (default: 0)
`);
    process.exit(0);
  }

  const env = String(opts.env || "development");
  const count = Math.max(1, Math.min(10_000, Math.floor(Number(opts.count) || 40)));
  const vipRatio = clamp01(opts.vipRatio);
  const adminRatio = clamp01(opts.adminRatio);
  const dbName = (opts.db && String(opts.db).trim()) || pickDbName(env);

  // Default: remote for staging/prod, local for dev.
  const remote = opts.remote || (env !== "development" && env !== "dev");

  const uniquePrefix = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const now = Date.now();

  const rows = [];
  for (let i = 0; i < count; i++) {
    const username = randomNumericUsername();
    const email = randomEmail(uniquePrefix, i + 1);
    const isAdmin = Math.random() < adminRatio ? 1 : 0;
    const isSuperAdmin = 0;

    // VIP: set expiry to future date.
    const isVip = Math.random() < vipRatio;
    const vipExpiresAt = isVip ? toIsoZ(now + 1000 * 60 * 60 * 24 * (7 + i)) : null;

    rows.push({ username, email, isAdmin, isSuperAdmin, vipExpiresAt });
  }

  // Single statement for efficiency.
  const valuesSql = rows
    .map((r) => {
      const vip = r.vipExpiresAt ? `'${r.vipExpiresAt.replace(/'/g, "''")}'` : "NULL";
      const u = r.username.replace(/'/g, "''");
      const e = r.email.replace(/'/g, "''");
      return `('${u}','${e}',${r.isAdmin},${r.isSuperAdmin},NULL,${vip})`;
    })
    .join(",\n");

  const sql = `-- Generated by scripts/seed-random-users.mjs
-- env=${env} db=${dbName} remote=${remote} count=${count}

INSERT INTO users (username, email, is_admin, is_super_admin, avatar_url, vip_expires_at)
VALUES
${valuesSql};
`;

  const tmpDir = path.resolve(process.cwd(), ".tmp");
  await fs.mkdir(tmpDir, { recursive: true });
  const sqlFile = path.join(tmpDir, `seed-users-${uniquePrefix}.sql`);
  await fs.writeFile(sqlFile, sql, "utf8");

  const wrangler = pickWranglerBin();
  const args = [
    "d1",
    "execute",
    dbName,
    "--config",
    "wrangler.jsonc",
    "--env",
    env === "dev" ? "development" : env,
    ...(remote ? ["--remote"] : []),
    "--file",
    sqlFile,
  ];

  console.log(`[seed] inserting ${count} users into D1 (${dbName}) env=${env} remote=${remote}`);
  console.log(`[seed] sql file: ${path.relative(process.cwd(), sqlFile)}`);

  await run(wrangler, args);

  console.log(`[seed] done. Sample emails:`);
  for (const r of rows.slice(0, Math.min(5, rows.length))) {
    console.log(` - ${r.email}`);
  }
  if (rows.length > 5) console.log(` - ... (${rows.length} total)`);
}

main().catch((err) => {
  console.error("[seed] failed:", err?.message || err);
  process.exit(1);
});


