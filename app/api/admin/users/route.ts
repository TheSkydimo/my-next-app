import { getCloudflareContext } from "@opennextjs/cloudflare";

type UserRow = {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  created_at: string;
};

async function assertAdmin(db: D1Database, adminEmail: string | null) {
  if (!adminEmail) {
    return new Response("缺少管理员邮箱", { status: 401 });
  }

  const { results } = await db
    .prepare("SELECT id FROM users WHERE email = ? AND is_admin = 1")
    .bind(adminEmail)
    .all();

  if (!results || results.length === 0) {
    return new Response("无权访问：不是管理员账号", { status: 403 });
  }

  return null;
}

// 获取用户列表（仅管理员）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const adminEmail = searchParams.get("adminEmail");

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authError = await assertAdmin(db, adminEmail);
  if (authError) return authError;

  const q = searchParams.get("q");

  let query =
    "SELECT id, username, email, is_admin, created_at FROM users ORDER BY created_at DESC";
  let bindValues: unknown[] = [];

  if (q) {
    query =
      "SELECT id, username, email, is_admin, created_at FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY created_at DESC";
    const pattern = `%${q}%`;
    bindValues = [pattern, pattern];
  }

  const { results } = await db.prepare(query).bind(...bindValues).all<UserRow>();

  return Response.json({
    users:
      results?.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        isAdmin: !!u.is_admin,
        createdAt: u.created_at,
      })) ?? [],
  });
}

type AdminActionBody = {
  adminEmail?: string;
  action?: "remove" | "set-admin";
  userId?: number;
};

// 管理员操作用户：删除用户 / 设置为管理员
export async function POST(request: Request) {
  const { adminEmail, action, userId } =
    (await request.json()) as AdminActionBody;

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authError = await assertAdmin(db, adminEmail ?? null);
  if (authError) return authError;

  if (!action || !userId) {
    return new Response("缺少必要参数", { status: 400 });
  }

  const { results } = await db
    .prepare(
      "SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?"
    )
    .bind(userId)
    .all<UserRow>();

  const target = results?.[0];

  if (!target) {
    return new Response("用户不存在", { status: 404 });
  }

  // 避免管理员误删自己
  if (action === "remove" && target.email === adminEmail) {
    return new Response("不能删除当前登录的管理员账号", { status: 400 });
  }

  switch (action) {
    case "remove": {
      await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
      break;
    }
    case "set-admin": {
      await db
        .prepare("UPDATE users SET is_admin = 1 WHERE id = ?")
        .bind(userId)
        .run();
      break;
    }
    default:
      return new Response("不支持的操作类型", { status: 400 });
  }

  return Response.json({ ok: true });
}


