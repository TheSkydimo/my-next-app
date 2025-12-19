import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sha256 } from "../../_utils/auth";
import { verifyAndUseEmailCode } from "../../_utils/emailCode";
import {
  convertDbAvatarUrlToPublicUrl,
  makeR2SchemeUrl,
  r2KeyFromSchemeUrl,
} from "../../_utils/r2ObjectUrls";

type UserRow = {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  avatar_url: string | null;
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

  // 确保 avatar_url 字段存在（兼容旧库，避免在没有该字段时直接报错）
  try {
    await db.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column name: avatar_url")) {
      console.error("确保 avatar_url 字段存在失败:", e);
      return new Response("服务器内部错误", { status: 500 });
    }
  }

  const queryResult = await db
    .prepare(
      "SELECT id, username, email, is_admin, avatar_url, created_at FROM users WHERE email = ?"
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
    avatarUrl: convertDbAvatarUrlToPublicUrl(user.avatar_url),
    createdAt: user.created_at,
  });
}

function normalizeAvatarDbUrl(input: string): string {
  // 兼容：如果有人把 /api/avatar/image?key=... 直接写进数据库，转回 r2://{key}
  if (input.startsWith("/api/avatar/image?")) {
    try {
      const url = new URL(input, "http://local");
      const key = url.searchParams.get("key");
      if (key && key.startsWith("avatars/")) {
        return makeR2SchemeUrl(key);
      }
    } catch {
      // ignore
    }
  }
  return input;
}

// 更新用户个人信息
export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    username?: string;
    oldPassword?: string;
    newPassword?: string;
    newEmail?: string;
    emailCode?: string;
    avatarUrl?: string | null;
  };

  const { email, username, oldPassword, newPassword, newEmail, emailCode, avatarUrl } =
    body;

  if (!email) {
    return new Response("邮箱不能为空", { status: 400 });
  }

  const hasAvatarField = Object.prototype.hasOwnProperty.call(
    body,
    "avatarUrl"
  );

  if (!username && !newPassword && !newEmail && !hasAvatarField) {
    return new Response("没有需要更新的字段", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  const r2 = env.ORDER_IMAGES as R2Bucket;

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

  // 头像允许设置为空字符串代表清空，所以只要客户端传了 avatarUrl 字段（即使为空字符串）
  // 就认为需要更新；未传该字段则不更新
  let prevAvatarUrl: string | null = null;
  let normalizedAvatarDbUrl: string | null = null;
  if (hasAvatarField) {
    // 先读旧头像，方便后续（最佳努力）删除旧 R2 对象
    const prev = await db
      .prepare("SELECT avatar_url FROM users WHERE email = ?")
      .bind(email)
      .all<{ avatar_url: string | null }>();
    prevAvatarUrl = prev.results?.[0]?.avatar_url ?? null;

    normalizedAvatarDbUrl =
      typeof avatarUrl === "string" && avatarUrl.trim()
        ? normalizeAvatarDbUrl(avatarUrl.trim())
        : null;

    fields.push("avatar_url = ?");
    values.push(normalizedAvatarDbUrl);
  }

  values.push(email);

  try {
    await db
      .prepare(`UPDATE users SET ${fields.join(", ")} WHERE email = ?`)
      .bind(...values)
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    if (msg.includes("UNIQUE constraint failed: users.email")) {
      return new Response("该邮箱已被使用", { status: 400 });
    }

    console.error("更新用户信息失败:", e);
    return new Response("更新用户信息失败", { status: 500 });
  }

  // 最佳努力删除旧头像（仅当：旧头像为 r2://avatars/..., 新头像不同/被清空）
  if (hasAvatarField && prevAvatarUrl) {
    const prevKey = r2KeyFromSchemeUrl(prevAvatarUrl);
    const nextKey =
      typeof normalizedAvatarDbUrl === "string"
        ? r2KeyFromSchemeUrl(normalizedAvatarDbUrl)
        : null;

    if (
      prevKey &&
      prevKey.startsWith("avatars/") &&
      // 新头像为空 或者 新 key 与旧 key 不同
      (!nextKey || nextKey !== prevKey)
    ) {
      try {
        await r2.delete(prevKey);
      } catch {
        // 删除失败不阻断流程
        console.error(`Failed to delete previous avatar object: ${prevKey}`);
      }
    }
  }

  // 如果更新了头像，返回“可直接展示”的 URL，避免前端把 r2:// 当作 <img src>
  if (hasAvatarField) {
    return Response.json({
      ok: true,
      avatarUrl: convertDbAvatarUrlToPublicUrl(normalizedAvatarDbUrl),
    });
  }

  return Response.json({ ok: true });
}


