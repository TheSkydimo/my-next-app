import { getCloudflareContext } from "@opennextjs/cloudflare";
import { convertDbAvatarUrlToPublicUrl } from "../../_utils/r2ObjectUrls";
import { requireAdminFromRequest } from "../_utils/adminSession";
import { deleteUserCascade } from "../_utils/deleteUserCascade";
import { assertSameOriginOrNoOrigin } from "../../_utils/requestOrigin";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

type UserRow = {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  // 是否为超级管理员（只有在特定查询中会被填充）
  is_super_admin?: number;
  avatar_url: string | null;
  vip_expires_at: string | null;
  created_at: string;
};

// 获取用户列表（仅管理员）
export const GET = withApiMonitoring(async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role"); // admin | user | null
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");

  // Input hardening: clamp paging (avoid huge responses).
  const page = Math.min(Math.max(Number(pageParam) || 1, 1), 10_000);
  const pageSize = Math.min(Math.max(Number(pageSizeParam) || 15, 1), 100);

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  const q = (searchParams.get("q") ?? "").trim();
  if (q.length > 80) {
    return new Response("Invalid q", { status: 400 });
  }

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

  const listQuery = `SELECT id, username, email, is_admin, avatar_url, vip_expires_at, created_at
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
      avatarUrl: convertDbAvatarUrlToPublicUrl(u.avatar_url),
      isVip:
        !!u.vip_expires_at &&
        !Number.isNaN(new Date(u.vip_expires_at).getTime()) &&
        new Date(u.vip_expires_at).getTime() > Date.now(),
      vipExpiresAt: u.vip_expires_at,
      createdAt: u.created_at,
    })) ?? [];

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return Response.json(
    {
      users,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}, { name: "GET /api/admin/users" });

type AdminActionBody = {
  action?: "remove" | "set-admin" | "unset-admin" | "set-vip";
  userEmail?: string;
  // 会员到期时间字符串（可为空），例如：2025-12-31T23:59:59.999Z
  vipExpiresAt?: string | null;
};

// 管理员操作用户：删除用户 / 设置为管理员
export const POST = withApiMonitoring(async function POST(request: Request) {
  const originGuard = assertSameOriginOrNoOrigin(request);
  if (originGuard) return originGuard;

  let body: AdminActionBody;
  try {
    body = (await request.json()) as AdminActionBody;
  } catch {
    return new Response("请求体格式不正确", { status: 400 });
  }

  const { action, userEmail, vipExpiresAt } = body;

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;
  const adminEmail = authed.admin.email;

  if (!action || !userEmail) {
    return new Response("缺少必要参数", { status: 400 });
  }

  const { results } = await db
    .prepare(
      "SELECT id, username, email, is_admin, is_super_admin, vip_expires_at, created_at FROM users WHERE email = ?"
    )
    .bind(userEmail)
    .all<UserRow>();

  const target = results?.[0];

  if (!target) {
    return new Response("用户不存在", { status: 404 });
  }

  // 避免管理员误删自己
  if (action === "remove" && target.email === adminEmail) {
    return new Response("不能删除当前登录的管理员账号", { status: 400 });
  }

  const isCurrentSuperAdmin =
    authed.admin.isSuperAdmin;

  // 如果是删除操作，且用户当前为有效会员，则不允许删除
  if (action === "remove" && target.vip_expires_at) {
    const expireTime = new Date(target.vip_expires_at).getTime();
    if (!Number.isNaN(expireTime) && expireTime > Date.now()) {
      return new Response("该用户当前为有效会员，会员未到期前无法删除用户信息", {
        status: 400,
      });
    }
  }

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
  if (target.is_super_admin === 1) {
    if (action === "remove") {
      return new Response("不能删除超级管理员账号", { status: 400 });
    }
    if (action === "unset-admin") {
      return new Response("不能取消超级管理员的管理员身份", { status: 400 });
    }
  }

  switch (action) {
    case "remove": {
      try {
        await deleteUserCascade({ db, userId: target.id, userEmail });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Do not leak internal error details to clients.
        if (msg.includes("FOREIGN KEY constraint failed")) {
          return new Response("删除失败：该用户存在关联数据，已阻止删除", {
            status: 409,
          });
        }
        console.error("admin remove user failed:", { targetId: target.id });
        return new Response("删除失败：服务器内部错误", { status: 500 });
      }
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
    case "set-vip": {
      // 会员到期时间可为空：表示取消会员
      if (vipExpiresAt == null || vipExpiresAt === "") {
        await db
          .prepare("UPDATE users SET vip_expires_at = NULL WHERE email = ?")
          .bind(userEmail)
          .run();
        break;
      }

      const parsed = new Date(vipExpiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return new Response("会员到期时间格式不正确", { status: 400 });
      }

      await db
        .prepare("UPDATE users SET vip_expires_at = ? WHERE email = ?")
        .bind(parsed.toISOString(), userEmail)
        .run();
      break;
    }
    default:
      return new Response("不支持的操作类型", { status: 400 });
  }

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}, { name: "POST /api/admin/users" });


