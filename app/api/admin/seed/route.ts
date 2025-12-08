import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sha256 } from "../../_utils/auth";

// 简单的初始化脚本：
// 1. 为 users 表增加 is_admin 字段（如果不存在）
// 2. 创建一个内置管理员账号（如果不存在）
//
// 仅用于开发环境或首次初始化时调用：
// - POST /api/admin/seed
// - 或直接在浏览器访问 GET /api/admin/seed

export async function POST() {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

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

  // 2. 创建内置管理员账号（如果不存在）
  const adminEmail = "zhouzhiou9588@163.com";
  const adminUsername = "admin";
  const adminPassword = "123456";

  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(adminEmail)
    .all();

  const password_hash = await sha256(adminPassword);

  if (!existing.results || existing.results.length === 0) {
    await db
      .prepare(
        "INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, 1)"
      )
      .bind(adminUsername, adminEmail, password_hash)
      .run();
  } else {
    await db
      .prepare("UPDATE users SET is_admin = 1, password_hash = ? WHERE email = ?")
      .bind(password_hash, adminEmail)
      .run();
  }

  return Response.json({
    ok: true,
    adminEmail,
    adminPassword,
    message:
      "管理员初始化完成，如需修改账号信息请在数据库中手动更新 users 表。",
  });
}

// 方便直接在浏览器里访问 URL 完成初始化
export async function GET() {
  return POST();
}


