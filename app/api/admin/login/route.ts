import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sha256 } from "../../_utils/auth";
import { convertDbAvatarUrlToPublicUrl } from "../../_utils/r2ObjectUrls";

type AdminRow = {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  is_super_admin: number;
};

export async function POST(request: Request) {
  const { email, password } = (await request.json()) as {
    email: string;
    password: string;
  };

  if (!email || !password) {
    return new Response("邮箱和密码不能为空", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const password_hash = await sha256(password);

  let results: AdminRow[] | undefined;

  try {
    // 返回完整管理员信息，包括 avatar_url，以便登录后直接使用，无需再次请求
    const queryResult = await db
      .prepare(
        `SELECT id, username, email, avatar_url, is_super_admin FROM users WHERE email = ? AND password_hash = ? AND is_admin = 1`
      )
      .bind(email, password_hash)
      .all<AdminRow>();
    results = queryResult.results;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.includes("no such column: is_admin") ||
      msg.includes("no such column: is_super_admin")
    ) {
      return new Response(
        "数据库缺少管理员相关字段，请先访问 /api/admin/seed 初始化管理员表结构和超级管理员账号",
        { status: 500 }
      );
    }
    throw e;
  }

  if (!results || results.length === 0) {
    return new Response("Invalid admin credentials", { status: 401 });
  }

  const admin = results[0];
  const isSuperAdmin = !!admin.is_super_admin;
  const role = isSuperAdmin ? "super_admin" : "admin";

  // 登录成功，返回完整管理员信息（包括头像 URL）
  return Response.json({
    ok: true,
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      avatarUrl: convertDbAvatarUrlToPublicUrl(admin.avatar_url),
      isSuperAdmin,
      role,
    },
  });
}


