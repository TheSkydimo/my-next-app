import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isValidEmail } from "../_utils/auth";
import { convertDbAvatarUrlToPublicUrl } from "../_utils/r2ObjectUrls";
import { verifyAndUseEmailCode } from "../_utils/emailCode";
import { generateNumericUsername } from "../_utils/user";
import { createSessionToken, getSessionCookieName } from "../_utils/session";
import { serializeCookie } from "../_utils/cookies";
import { readJsonBody } from "../_utils/body";
import { ensureUsersAvatarUrlColumn, ensureUsersIsAdminColumn } from "../_utils/usersTable";
import { getSessionSecret } from "../_utils/sessionSecret";
import { isSecureRequest } from "../_utils/request";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

type UserRow = {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  is_admin: number;
};

export const POST = withApiMonitoring(async function POST(request: Request) {
  // 解析请求体并显式标注类型，避免 request.json() 推断为 unknown
  const parsed = await readJsonBody<{
    email: string;
    emailCode: string;
    emailCodeChallengeId: string;
    remember?: boolean;
  }>(request);
  if (!parsed.ok) {
    return new Response("Invalid JSON", { status: 400 });
  }
  const { email, emailCode, emailCodeChallengeId, remember } = parsed.value;

  if (!email) {
    return new Response("邮箱不能为空", { status: 400 });
  }

  if (email.length > 320) {
    return new Response("邮箱格式不正确", { status: 400 });
  }

  if (!isValidEmail(email)) {
    return new Response("邮箱格式不正确", { status: 400 });
  }

  if (!emailCode) {
    return new Response("邮箱验证码不能为空", { status: 400 });
  }

  if (!emailCodeChallengeId) {
    return new Response("邮箱验证码错误或已过期", { status: 400 });
  }

  if (emailCodeChallengeId.length > 64) {
    return new Response("邮箱验证码错误或已过期", { status: 400 });
  }

  if (emailCode.length > 32) {
    return new Response("邮箱验证码错误或已过期", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  // 兼容旧库：确保常用字段存在（避免 SELECT 时直接报错）
  try {
    await ensureUsersIsAdminColumn(db);
    await ensureUsersAvatarUrlColumn(db);
  } catch {
    console.error("确保 users 表字段存在失败");
    return new Response("服务器内部错误", { status: 500 });
  }

  const okCode = await verifyAndUseEmailCode({
    db,
    email,
    code: emailCode,
    purpose: "user-login",
    challengeId: emailCodeChallengeId,
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
    // 首次登录：自动创建用户（仅邮箱验证码）
    let finalUsername = generateNumericUsername(10);
    let inserted = false;

    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await db
          .prepare("INSERT INTO users (username, email) VALUES (?, ?)")
          .bind(finalUsername, email)
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

        console.error("创建用户失败");
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

  // 登录成功：可选下发 Session Cookie（用于“记住登录状态”）
  const sessionSecret = getSessionSecret(env);

  const headers: HeadersInit = {};
  if (sessionSecret) {
    const rememberMe = remember !== false; // default: true
    // Security: even for session cookies (no Max-Age), keep a bounded server-side token TTL.
    const cookieMaxAgeSeconds = 60 * 60 * 24 * 30; // 30 days
    const tokenMaxAgeSeconds = rememberMe ? cookieMaxAgeSeconds : 60 * 60 * 12; // 12 hours (session cookie)
    const { token } = await createSessionToken({
      secret: sessionSecret,
      userId: row.id,
      maxAgeSeconds: tokenMaxAgeSeconds,
    });

    const secure = isSecureRequest(request);

    headers["Set-Cookie"] = serializeCookie(getSessionCookieName(), token, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: "/",
      // remember=false 时不设置 Max-Age => session cookie（关闭浏览器即失效）
      ...(rememberMe ? { maxAge: cookieMaxAgeSeconds } : {}),
    });
  }
  headers["Cache-Control"] = "no-store";

  return Response.json({
    ok: true,
    user: {
      id: row.id,
      username: row.username,
      email: row.email,
      avatarUrl: convertDbAvatarUrlToPublicUrl(row.avatar_url),
      isAdmin: !!row.is_admin,
    },
  }, { headers });
}, { name: "POST /api/login" });
