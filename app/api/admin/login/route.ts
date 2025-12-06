import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sha256 } from "../../_utils/auth";

type AdminRow = {
  id: number;
  username: string;
  email: string;
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
    const queryResult = await db
      .prepare(
        `SELECT id, username, email FROM users WHERE email = ? AND password_hash = ? AND is_admin = 1`
      )
      .bind(email, password_hash)
      .all<AdminRow>();
    results = queryResult.results;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such column: is_admin")) {
      return new Response(
        "数据库缺少 is_admin 字段，请先访问 /api/admin/seed 初始化管理员表结构和账号",
        { status: 500 }
      );
    }
    throw e;
  }

  if (!results || results.length === 0) {
    return new Response("Invalid admin credentials", { status: 401 });
  }

  const admin = results[0];

  return Response.json({ ok: true, admin });
}


