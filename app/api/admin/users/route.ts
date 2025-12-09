import { getCloudflareContext } from "@opennextjs/cloudflare";

type UserRow = {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  avatar_url: string | null;
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

async function isSuperAdmin(db: D1Database, adminEmail: string): Promise<boolean> {
  const { results } = await db
    .prepare(
      "SELECT is_super_admin FROM users WHERE email = ? AND is_admin = 1"
    )
    .bind(adminEmail)
    .all<{ is_super_admin: number }>();

  const row = results?.[0];
  return !!row?.is_super_admin;
}

// 获取用户列表（仅管理员）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const adminEmail = searchParams.get("adminEmail");
  const role = searchParams.get("role"); // admin | user | null
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");

  const page = Math.max(Number(pageParam) || 1, 1);
  const pageSize = Math.max(Number(pageSizeParam) || 15, 1);

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authError = await assertAdmin(db, adminEmail);
  if (authError) return authError;

  const q = searchParams.get("q");

  const whereParts: string[] = [];
  const bindValues: unknown[] = [];

  if (role === "admin") {
    whereParts.push("is_admin = 1");
  } else if (role === "user") {
    whereParts.push("is_admin = 0");
  }

  if (q) {
    whereParts.push("(username LIKE ? OR email LIKE ?)");
    const pattern = `%${q}%`;
    bindValues.push(pattern, pattern);
  }

  const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  // 统计总数，用于分页
  const countQuery = `SELECT COUNT(*) as total FROM users ${whereSql}`;
  const countResult = await db.prepare(countQuery).bind(...bindValues).all<{
    total: number;
  }>();
  const total = (countResult.results?.[0]?.total as number | undefined) ?? 0;

  const offset = (page - 1) * pageSize;

  const listQuery = `SELECT id, username, email, is_admin, avatar_url, created_at
    FROM users
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?`;

  const { results } = await db
    .prepare(listQuery)
    .bind(...bindValues, pageSize, offset)
    .all<UserRow>();

  const users =
    results?.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      isAdmin: !!u.is_admin,
      avatarUrl: u.avatar_url,
      createdAt: u.created_at,
    })) ?? [];

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return Response.json({
    users,
    pagination: {
      total,
      page,
      pageSize,
      totalPages,
    },
  });
}

type AdminActionBody = {
  adminEmail?: string;
  action?: "remove" | "set-admin" | "unset-admin";
  userEmail?: string;
};

// 管理员操作用户：删除用户 / 设置为管理员
export async function POST(request: Request) {
  const { adminEmail, action, userEmail } =
    (await request.json()) as AdminActionBody;

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authError = await assertAdmin(db, adminEmail ?? null);
  if (authError) return authError;

  if (!action || !userEmail) {
    return new Response("缺少必要参数", { status: 400 });
  }

  const { results } = await db
    .prepare(
      "SELECT id, username, email, is_admin, is_super_admin, created_at FROM users WHERE email = ?"
    )
    .bind(userEmail)
    .all<
      UserRow & {
        is_super_admin: number;
      }
    >();

  const target = results?.[0];

  if (!target) {
    return new Response("用户不存在", { status: 404 });
  }

  // 避免管理员误删自己
  if (action === "remove" && target.email === adminEmail) {
    return new Response("不能删除当前登录的管理员账号", { status: 400 });
  }

  const isCurrentSuperAdmin =
    adminEmail != null ? await isSuperAdmin(db, adminEmail) : false;

  // 只有超级管理员可以：
  // - 提升/降级管理员（set-admin / unset-admin）
  // - 删除管理员账号
  if (!isCurrentSuperAdmin) {
    if (action === "set-admin" || action === "unset-admin") {
      return new Response("无权执行该操作：需要超级管理员权限", { status: 403 });
    }
    if (action === "remove" && target.is_admin === 1) {
      return new Response("无权删除管理员账号：需要超级管理员权限", {
        status: 403,
      });
    }
  }

  // 禁止对超级管理员账号执行危险操作，避免误删或降级锁死后台
  if ((target as any).is_super_admin === 1) {
    if (action === "remove") {
      return new Response("不能删除超级管理员账号", { status: 400 });
    }
    if (action === "unset-admin") {
      return new Response("不能取消超级管理员的管理员身份", { status: 400 });
    }
  }

  switch (action) {
    case "remove": {
      await db.prepare("DELETE FROM users WHERE email = ?").bind(userEmail).run();
      break;
    }
    case "set-admin": {
      // 最多允许 15 个管理员
      const { results: countResults } = await db
        .prepare("SELECT COUNT(*) AS total FROM users WHERE is_admin = 1")
        .all<{ total: number }>();
      const totalAdmins =
        (countResults?.[0]?.total as number | undefined) ?? 0;
      if (totalAdmins >= 15) {
        return new Response("管理员数量已达上限（15 个）", { status: 400 });
      }

      await db
        .prepare("UPDATE users SET is_admin = 1 WHERE email = ?")
        .bind(userEmail)
        .run();
      break;
    }
    case "unset-admin": {
      // 不允许把自己从管理员降级，避免锁死后台
      if (target.email === adminEmail) {
        return new Response("不能取消当前登录账号的管理员身份", { status: 400 });
      }

      await db
        .prepare("UPDATE users SET is_admin = 0 WHERE email = ?")
        .bind(userEmail)
        .run();
      break;
    }
    default:
      return new Response("不支持的操作类型", { status: 400 });
  }

  return Response.json({ ok: true });
}


