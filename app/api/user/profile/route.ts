import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sha256 } from "../../_utils/auth";
import { verifyAndUseEmailCode } from "../../_utils/emailCode";

type UserRow = {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  created_at: string;
};

// 获取用户个人信息
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return new Response("缺少 email 参数", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const queryResult = await db
    .prepare(
      "SELECT id, username, email, is_admin, created_at FROM users WHERE email = ?"
    )
    .bind(email)
    .all<UserRow>();

  const user = queryResult.results?.[0];

  if (!user) {
    return new Response("用户不存在", { status: 404 });
  }

  return Response.json({
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: !!user.is_admin,
    createdAt: user.created_at,
  });
}

// 更新用户个人信息
export async function POST(request: Request) {
  const {
    email,
    username,
    oldPassword,
    newPassword,
    newEmail,
    emailCode,
  } = (await request.json()) as {
    email?: string; // 当前邮箱
    username?: string;
    oldPassword?: string;
    newPassword?: string;
    newEmail?: string;
    emailCode?: string;
  };

  if (!email) {
    return new Response("邮箱不能为空", { status: 400 });
  }

  if (!username && !newPassword && !newEmail) {
    return new Response("没有需要更新的字段", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  // 如需修改邮箱，必须同时修改密码
  if (newEmail && !newPassword) {
    return new Response("修改邮箱时必须同时设置新密码", { status: 400 });
  }

  // 如需修改密码，必须校验旧密码
  if (newPassword) {
    if (!oldPassword) {
      return new Response("修改密码需要提供旧密码", { status: 400 });
    }

    const oldHash = await sha256(oldPassword);
    const { results } = await db
      .prepare("SELECT id FROM users WHERE email = ? AND password_hash = ?")
      .bind(email, oldHash)
      .all();

    if (!results || results.length === 0) {
      return new Response("旧密码不正确", { status: 400 });
    }
  }

  // 如需修改邮箱，必须经过邮箱验证码验证（验证码发到新邮箱）
  if (newEmail) {
    if (!emailCode) {
      return new Response("修改邮箱需要提供邮箱验证码", { status: 400 });
    }

    const okCode = await verifyAndUseEmailCode({
      db,
      email: newEmail,
      code: emailCode,
      purpose: "change-email",
    });

    if (!okCode) {
      return new Response("邮箱验证码错误或已过期", { status: 400 });
    }
  }

  // 组合需要更新的字段
  const fields: string[] = [];
  const values: unknown[] = [];

  if (username) {
    fields.push("username = ?");
    values.push(username);
  }

  if (newPassword) {
    const newHash = await sha256(newPassword);
    fields.push("password_hash = ?");
    values.push(newHash);
  }

  if (newEmail) {
    fields.push("email = ?");
    values.push(newEmail);
  }

  values.push(email);

  try {
    await db
      .prepare(`UPDATE users SET ${fields.join(", ")} WHERE email = ?`)
      .bind(...values)
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    if (msg.includes("UNIQUE constraint failed: users.username")) {
      return new Response("用户名已被使用", { status: 400 });
    }

    if (msg.includes("UNIQUE constraint failed: users.email")) {
      return new Response("该邮箱已被使用", { status: 400 });
    }

    console.error("更新用户信息失败:", e);
    return new Response("更新用户信息失败", { status: 500 });
  }

  return Response.json({ ok: true });
}


