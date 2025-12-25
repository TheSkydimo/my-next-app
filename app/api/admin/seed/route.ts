import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureUsersTable } from "../../_utils/usersTable";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

// 简单的初始化脚本：
// 1. 为 users 表增加 is_admin 字段（如果不存在）
// 2. 为 users 表增加 is_super_admin 字段（如果不存在）
// 3. 创建一个内置超级管理员账号（如果不存在）
//
// ⚠️ 安全提示
// 该接口仅用于开发/初始化场景。
// 通过环境变量 ALLOW_ADMIN_SEED 控制是否允许调用：
// - 开发环境：在 .dev.vars 中配置 ALLOW_ADMIN_SEED="true"
// - 生产环境：不要配置 ALLOW_ADMIN_SEED（或设置为其他值），接口会直接返回 404
//
// 使用方式：
// - POST /api/admin/seed
// - 或直接在浏览器访问 GET /api/admin/seed（仅在 ALLOW_ADMIN_SEED 为 "true" 时生效）

function assertSeedAllowed(env: unknown): Response | null {
  const envRecord = env as Record<string, unknown>;
  const flag = String(envRecord.ALLOW_ADMIN_SEED ?? "");
  if (flag !== "true") {
    // 对外表现为 404，避免暴露此接口存在
    return new Response("Not found", { status: 404 });
  }
  return null;
}

async function runSeed(): Promise<Response> {
  const { env } = await getCloudflareContext();

  const notAllowed = assertSeedAllowed(env);
  if (notAllowed) return notAllowed;

  const db = env.my_user_db as D1Database;
  await ensureUsersTable(db);

  // 1. 确保 is_admin 字段存在
  try {
    await db
      .prepare(
        "ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0"
      )
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 已经有该字段时忽略错误
    if (!msg.includes("duplicate column name: is_admin")) {
      console.error("添加 is_admin 字段失败:", e);
      return new Response("初始化管理员表结构失败", { status: 500 });
    }
  }

  // 1.1 确保 is_super_admin 字段存在
  try {
    await db
      .prepare(
        "ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0"
      )
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 已经有该字段时忽略错误
    if (!msg.includes("duplicate column name: is_super_admin")) {
      console.error("添加 is_super_admin 字段失败:", e);
      return new Response("初始化超级管理员表结构失败", { status: 500 });
    }
  }

  // 1.2 确保 avatar_url 字段存在（允许为空）
  try {
    await db
      .prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT")
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 已经有该字段时忽略错误
    if (!msg.includes("duplicate column name: avatar_url")) {
      console.error("添加 avatar_url 字段失败:", e);
      return new Response("初始化头像字段失败", { status: 500 });
    }
  }

  // 1.3 确保会员到期时间字段存在（允许为空）
  // 说明：
  // - 会员有效期在 vip_expires_at 之前，视为会员中
  // - 为空或早于当前时间则视为非会员
  try {
    await db
      .prepare("ALTER TABLE users ADD COLUMN vip_expires_at TIMESTAMP")
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 已经有该字段时忽略错误
    if (!msg.includes("duplicate column name: vip_expires_at")) {
      console.error("添加 vip_expires_at 字段失败:", e);
      return new Response("初始化会员字段失败", { status: 500 });
    }
  }

  // 2. 创建内置超级管理员账号（如果不存在）
  const adminEmail = "zhouzhiou9588@163.com";
  const adminUsername = "admin";

  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(adminEmail)
    .all();

  if (!existing.results || existing.results.length === 0) {
    await db
      .prepare(
        "INSERT INTO users (username, email, is_admin, is_super_admin) VALUES (?, ?, 1, 1)"
      )
      .bind(adminUsername, adminEmail)
      .run();
  } else {
    await db
      .prepare(
        "UPDATE users SET is_admin = 1, is_super_admin = 1 WHERE email = ?"
      )
      .bind(adminEmail)
      .run();
  }

  return Response.json({
    ok: true,
    adminEmail,
    message:
      "超级管理员初始化完成。管理端登录已改为邮箱验证码登录（无需任何口令）。请务必在生产环境关闭 ALLOW_ADMIN_SEED。",
  });
}

export const POST = withApiMonitoring(async function POST() {
  return await runSeed();
}, { name: "POST /api/admin/seed" });

// 方便直接在浏览器里访问 URL 完成初始化
export const GET = withApiMonitoring(async function GET(request: Request) {
  void request;
  return await runSeed();
}, { name: "GET /api/admin/seed" });

