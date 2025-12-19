import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sha256, isValidEmail } from "../_utils/auth";
import { convertDbAvatarUrlToPublicUrl } from "../_utils/r2ObjectUrls";
import { verifyAndUseEmailCode } from "../_utils/emailCode";
import { generateNumericUsername } from "../_utils/user";

type UserRow = {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  is_admin: number;
};

async function ensureIsAdminColumn(db: D1Database) {
  try {
    await db
      .prepare("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column name: is_admin")) {
      throw e;
    }
  }
}

async function ensureAvatarUrlColumn(db: D1Database) {
  try {
    await db.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column name: avatar_url")) {
      throw e;
    }
  }
}

export async function POST(request: Request) {
  // 解析请求体并显式标注类型，避免 request.json() 推断为 unknown
  const { email, emailCode } = (await request.json()) as {
    email: string;
    emailCode: string;
  };

  if (!email) {
    return new Response("邮箱不能为空", { status: 400 });
  }

  if (!isValidEmail(email)) {
    return new Response("邮箱格式不正确", { status: 400 });
  }

  if (!emailCode) {
    return new Response("邮箱验证码不能为空", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  // 兼容旧库：确保常用字段存在（避免 SELECT 时直接报错）
  try {
    await ensureIsAdminColumn(db);
    await ensureAvatarUrlColumn(db);
  } catch (e) {
    console.error("确保 users 表字段存在失败:", e);
    return new Response("服务器内部错误", { status: 500 });
  }

  const okCode = await verifyAndUseEmailCode({
    db,
    email,
    code: emailCode,
    purpose: "user-login",
  });

  if (!okCode) {
    return new Response("邮箱验证码错误或已过期", { status: 400 });
  }

  // 返回完整用户信息，包括 avatar_url，以便登录后直接使用，无需再次请求
  let row: UserRow | null = null;

  const existing = await db
    .prepare(
      `SELECT id, username, email, avatar_url, is_admin FROM users WHERE email = ?`
    )
    .bind(email)
    .all<UserRow>();

  if (existing.results && existing.results.length > 0) {
    row = existing.results[0];
  } else {
    // 首次登录：自动创建用户（无密码登录也需要占位 password_hash，兼容旧表结构）
    const password_hash = await sha256(crypto.randomUUID());

    let finalUsername = generateNumericUsername(10);
    let inserted = false;

    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await db
          .prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)")
          .bind(finalUsername, email, password_hash)
          .run();
        inserted = true;
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);

        if (msg.includes("UNIQUE constraint failed: users.email")) {
          // 理论上不会走到这里（因为前面已查过），但并发情况下可能发生：直接继续查
          break;
        }

        if (msg.includes("UNIQUE constraint failed: users.username")) {
          // 自动生成的用户名碰撞：重试
          finalUsername = generateNumericUsername(10);
          continue;
        }

        console.error("创建用户失败:", e);
        return new Response("登录失败，请稍后再试", { status: 500 });
      }
    }

    if (!inserted) {
      // 兜底：再读一次用户
    }

    const created = await db
      .prepare(
        `SELECT id, username, email, avatar_url, is_admin FROM users WHERE email = ?`
      )
      .bind(email)
      .all<UserRow>();

    row = created.results?.[0] ?? null;
  }

  if (!row) {
    return new Response("登录失败，请稍后重试", { status: 500 });
  }

  // 登录成功，返回完整用户信息（下一步可设置 Cookie Session）
  return Response.json({
    ok: true,
    user: {
      id: row.id,
      username: row.username,
      email: row.email,
      avatarUrl: convertDbAvatarUrlToPublicUrl(row.avatar_url),
      isAdmin: !!row.is_admin,
    },
  });
}
