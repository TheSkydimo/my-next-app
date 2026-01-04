import { getCloudflareContext } from "@opennextjs/cloudflare";
import { verifyAndUseEmailCode } from "../../_utils/emailCode";
import { requireUserFromRequest } from "../_utils/userSession";
import { unauthorizedWithClearedSession } from "../../_utils/unauthorized";
import { isValidEmail } from "../../_utils/auth";
import { assertSameOriginOrNoOrigin } from "../../_utils/requestOrigin";

import {
  convertDbAvatarUrlToPublicUrl,
  makeR2SchemeUrl,
  r2KeyFromSchemeUrl,
} from "../../_utils/r2ObjectUrls";
import { normalizeAppLanguage, type AppLanguage } from "../../_utils/appLanguage";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

type UserRow = {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  avatar_url: string | null;
  created_at: string;
};

function withNoStore(res: Response) {
  const next = new Response(res.body, res);
  next.headers.set("Cache-Control", "no-store");
  return next;
}

function resolveRequestLanguage(options: {
  request: Request;
  bodyLanguage?: unknown;
}): AppLanguage {
  const { request, bodyLanguage } = options;
  // 1) client explicit language
  if (bodyLanguage === "en-US" || bodyLanguage === "zh-CN") {
    return normalizeAppLanguage(bodyLanguage);
  }

  // 2) Accept-Language fallback (simple heuristic)
  const accept = String(request.headers.get("accept-language") ?? "")
    .trim()
    .toLowerCase();
  if (accept.startsWith("en") || accept.includes(",en") || accept.includes("-en")) {
    return "en-US";
  }

  return "zh-CN";
}

async function ensureAvatarUrlColumn(db: D1Database) {
  // 确保 avatar_url 字段存在（兼容旧库，避免在没有该字段时直接报错）
  try {
    await db.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column name: avatar_url")) {
      throw e;
    }
  }
}

// 获取用户个人信息
export const GET = withApiMonitoring(async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return withNoStore(authed);

  try {
    await ensureAvatarUrlColumn(db);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error(
      "确保 avatar_url 字段存在失败:",
      JSON.stringify(
        {
          name: err.name,
          message: err.message,
          stack:
            process.env.NODE_ENV === "development"
              ? err.stack?.slice(0, 2000)
              : undefined,
        },
        null,
        0
      )
    );
    return withNoStore(new Response("服务器内部错误", { status: 500 }));
  }

  const queryResult = await db
    .prepare(
      "SELECT id, username, email, is_admin, avatar_url, created_at FROM users WHERE id = ?"
    )
    .bind(authed.user.id)
    .all<UserRow>();

  const user = queryResult.results?.[0];

  if (!user) {
    return withNoStore(unauthorizedWithClearedSession(request));
  }

  return withNoStore(Response.json({
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: !!user.is_admin,
    avatarUrl: convertDbAvatarUrlToPublicUrl(user.avatar_url),
    createdAt: user.created_at,
  }));
}, { name: "GET /api/user/profile" });

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

function isOwnedAvatarR2KeyForUser(userId: number, key: string): boolean {
  return key.startsWith(`avatars/${userId}/`);
}

// 更新用户个人信息
export const POST = withApiMonitoring(async function POST(request: Request) {
  const originGuard = assertSameOriginOrNoOrigin(request);
  if (originGuard) return originGuard;

  const body = (await request.json()) as {
    username?: string;
    newEmail?: string;
    emailCode?: string;
    emailCodeChallengeId?: string;
    avatarUrl?: string | null;
    language?: unknown;
  };

  const language = resolveRequestLanguage({ request, bodyLanguage: body.language });

  const {
    username,
    newEmail,
    emailCode,
    emailCodeChallengeId,
    avatarUrl,
  } = body;

  const hasAvatarField = Object.prototype.hasOwnProperty.call(
    body,
    "avatarUrl"
  );

  if (!username && !newEmail && !hasAvatarField) {
    if(language === "zh-CN") {
      return withNoStore(new Response("没有需要更新的字段", { status: 400 }));
    } else {
      return withNoStore(new Response("No fields to update", { status: 400 }));
    }
  }

  // ---- input hardening (length + basic format) ----
  const usernameTrimmed = typeof username === "string" ? username.trim() : null;
  if (usernameTrimmed != null) {
    if (!usernameTrimmed) {
      if(language === "zh-CN") {
        return withNoStore(new Response("用户名不能为空", { status: 400 }));
      } else {
        return withNoStore(new Response("Username cannot be empty", { status: 400 }));
      }
    }
    if (usernameTrimmed.length > 50) {
      if(language === "zh-CN") {
        return withNoStore(new Response("用户名过长", { status: 400 }));
      } else {
        return withNoStore(new Response("Username is too long", { status: 400 }));
      }
    }
  }

  const newEmailTrimmed = typeof newEmail === "string" ? newEmail.trim() : null;
  if (newEmailTrimmed != null) {
    if (!newEmailTrimmed) {
      return withNoStore(new Response("邮箱不能为空", { status: 400 }));
    }
    if (newEmailTrimmed.length > 320 || !isValidEmail(newEmailTrimmed)) {
      return withNoStore(new Response("邮箱格式不正确", { status: 400 }));
    }
  }

  if (typeof emailCode === "string" && emailCode.length > 32) {
    return withNoStore(new Response("邮箱验证码错误或已过期", { status: 400 }));
  }
  if (typeof emailCodeChallengeId === "string" && emailCodeChallengeId.length > 64) {
    return withNoStore(new Response("邮箱验证码错误或已过期", { status: 400 }));
  }

  if (typeof avatarUrl === "string" && avatarUrl.length > 2048) {
    if(language === "zh-CN") {
      return withNoStore(new Response("头像地址过长", { status: 400 }));
    } else {
      return withNoStore(new Response("Avatar URL is too long", { status: 400 }));
    }
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  const r2 = env.ORDER_IMAGES as R2Bucket;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return withNoStore(authed);

  // POST 也需要兼容旧库（避免用户只调用更新接口而未触发 GET）
  try {
    await ensureAvatarUrlColumn(db);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error(
      "确保 avatar_url 字段存在失败:",
      JSON.stringify(
        {
          name: err.name,
          message: err.message,
          stack:
            process.env.NODE_ENV === "development"
              ? err.stack?.slice(0, 2000)
              : undefined,
        },
        null,
        0
      )
    );
    return withNoStore(new Response("服务器内部错误", { status: 500 }));
  }

  // 如需修改邮箱，必须经过邮箱验证码验证（验证码发到新邮箱）
  if (newEmailTrimmed) {
    if (!emailCode) {
      if(language === "zh-CN") {
        return withNoStore(new Response("修改邮箱需要提供邮箱验证码", { status: 400 }));
      } else {
        return withNoStore(new Response("Email verification code is required", { status: 400 }));
      }
    }

    if (!emailCodeChallengeId) {
      if(language === "zh-CN") {
        return withNoStore(new Response("邮箱验证码错误或已过期", { status: 400 }));
      } else {
        return withNoStore(new Response("Email verification code is incorrect or expired", { status: 400 }));
      }
    }

    const okCode = await verifyAndUseEmailCode({
      db,
      email: newEmailTrimmed,
      code: emailCode,
      purpose: "change-email",
      challengeId: emailCodeChallengeId,
    });

    if (!okCode) {
      if(language === "zh-CN") {
        return withNoStore(new Response("邮箱验证码错误或已过期", { status: 400 }));
      } else {
        return withNoStore(new Response("Email verification code is incorrect or expired", { status: 400 }));
      }
    }
  }

  // 组合需要更新的字段
  const fields: string[] = [];
  const values: unknown[] = [];

  if (username) {
    fields.push("username = ?");
    values.push(usernameTrimmed ?? username);
  }

  if (newEmailTrimmed) {
    fields.push("email = ?");
    values.push(newEmailTrimmed);
  }

  // 头像允许设置为空字符串代表清空，所以只要客户端传了 avatarUrl 字段（即使为空字符串）
  // 就认为需要更新；未传该字段则不更新
  let prevAvatarUrl: string | null = null;
  let normalizedAvatarDbUrl: string | null = null;
  if (hasAvatarField) {
    // 禁止 data: base64（体积大、不可缓存、会导致返回 avatarUrl 为 null 进而“更新成功但不显示”）
    if (typeof avatarUrl === "string" && avatarUrl.trim().startsWith("data:")) {
      if(language === "zh-CN") {
        return withNoStore(new Response("不支持 base64(data:) 头像，请使用“上传头像”功能", {
          status: 400,
        }));
      } else {
        return withNoStore(new Response("Unsupported base64(data:) avatar, please use the “Upload avatar” function", {
        status: 400,
      }));
      }
    }

    // 先读用户 id 与旧头像，方便后续校验“头像 key 归属”，以及（最佳努力）删除旧 R2 对象
    const prev = await db
      .prepare("SELECT avatar_url FROM users WHERE id = ?")
      .bind(authed.user.id)
      .all<{ id: number; avatar_url: string | null }>();

    const prevRow = prev.results?.[0];
    if (!prevRow) {
      if(language === "zh-CN") {
        return withNoStore(new Response("用户不存在", { status: 404 }));
      } else {
        return withNoStore(new Response("User not found", { status: 404 }));
      }
    }

    prevAvatarUrl = prevRow.avatar_url ?? null;

    normalizedAvatarDbUrl =
      typeof avatarUrl === "string" && avatarUrl.trim()
        ? normalizeAvatarDbUrl(avatarUrl.trim())
        : null;

    // 如果用户尝试写入 r2://avatars/...，必须是自己的 avatars/{userId}/...，防止引用/删除到别人的头像对象
    if (normalizedAvatarDbUrl) {
      const key = r2KeyFromSchemeUrl(normalizedAvatarDbUrl);
      if (key && key.startsWith("avatars/")) {
        if (!isOwnedAvatarR2KeyForUser(authed.user.id, key)) {
          if(language === "zh-CN") {
            return withNoStore(new Response("非法头像地址：只能使用自己上传的头像", {
              status: 400,
            }));
          } else {
            return withNoStore(new Response("Invalid avatar URL: only own uploaded avatars can be used", {
              status: 400,
            }));
          }
        }
      }
    }

    fields.push("avatar_url = ?");
    values.push(normalizedAvatarDbUrl);
  }

  values.push(authed.user.id);

  try {
    await db
      .prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    if (msg.includes("UNIQUE constraint failed: users.email")) {
      return withNoStore(new Response("该邮箱已被使用", { status: 400 }));
    }

    {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error(
        "更新用户信息失败:",
        JSON.stringify(
          {
            name: err.name,
            message: err.message,
            stack:
              process.env.NODE_ENV === "development"
                ? err.stack?.slice(0, 2000)
                : undefined,
          },
          null,
          0
        )
      );
    }
    if(language === "zh-CN") {
      return withNoStore(new Response("更新用户信息失败", { status: 500 }));
    } else {
      return withNoStore(new Response("Failed to update user information", { status: 500 }));
    }
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
      // 只允许删除当前用户目录下的头像，避免误删他人对象
      isOwnedAvatarR2KeyForUser(authed.user.id, prevKey) &&
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
    return withNoStore(Response.json({
      ok: true,
      avatarUrl: convertDbAvatarUrlToPublicUrl(normalizedAvatarDbUrl),
    }));
  }

  return withNoStore(Response.json({ ok: true }));
}, { name: "POST /api/user/profile" });


