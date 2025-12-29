import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isValidEmail } from "../../_utils/auth";
import { convertDbAvatarUrlToPublicUrl } from "../../_utils/r2ObjectUrls";
import { verifyAndUseEmailCode } from "../../_utils/emailCode";
import { createSessionToken, getSessionCookieName } from "../../_utils/session";
import { serializeCookie } from "../../_utils/cookies";
import { readJsonBody } from "../../_utils/body";
import { getSessionSecret } from "../../_utils/sessionSecret";
import { isSecureRequest } from "../../_utils/request";
import {
  ensureUsersAvatarUrlColumn,
  ensureUsersIsAdminColumn,
  ensureUsersIsSuperAdminColumn,
} from "../../_utils/usersTable";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

type AdminRow = {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  is_super_admin: number;
};

export const POST = withApiMonitoring(async function POST(request: Request) {
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

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  // 确保管理员字段存在（避免旧库直接报错）
  try {
    await ensureUsersIsAdminColumn(db);
    await ensureUsersIsSuperAdminColumn(db);
    await ensureUsersAvatarUrlColumn(db);
  } catch {
    console.error("确保 users 表字段存在失败");
    return new Response("服务器内部错误", { status: 500 });
  }

  const okCode = await verifyAndUseEmailCode({
    db,
    email,
    code: emailCode,
    purpose: "admin-login",
    challengeId: emailCodeChallengeId,
  });

  if (!okCode) {
    return new Response("邮箱验证码错误或已过期", { status: 400 });
  }

  let results: AdminRow[] | undefined;

  try {
    // 返回完整管理员信息，包括 avatar_url，以便登录后直接使用，无需再次请求
    const queryResult = await db
      .prepare(
        `SELECT id, username, email, avatar_url, is_super_admin FROM users WHERE email = ? AND is_admin = 1`
      )
      .bind(email)
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
    return new Response("无权登录：不是管理员账号", { status: 403 });
  }

  const admin = results[0];
  const isSuperAdmin = !!admin.is_super_admin;
  const role = isSuperAdmin ? "super_admin" : "admin";

  // 登录成功：下发与客户端一致的 Session Cookie（用于“记住登录状态”）
  const sessionSecret = getSessionSecret(env);
  const headers: HeadersInit = {};

  if (sessionSecret) {
    const rememberMe = remember !== false; // default: true
    const maxAgeSeconds = rememberMe ? 60 * 60 * 24 * 30 : 0; // 30 days or session cookie
    const { token } = await createSessionToken({
      secret: sessionSecret,
      userId: admin.id,
      maxAgeSeconds: rememberMe ? maxAgeSeconds : 60 * 60 * 24 * 30,
    });

    const secure = isSecureRequest(request);
    headers["Set-Cookie"] = serializeCookie(getSessionCookieName(), token, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: "/",
      ...(rememberMe ? { maxAge: maxAgeSeconds } : {}),
    });
  }
  headers["Cache-Control"] = "no-store";

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
  }, { headers });
}, { name: "POST /api/admin/login" });


