import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isValidEmail, sha256 } from "../_utils/auth";
import { verifyAndUseEmailCode } from "../_utils/emailCode";
import { generateNumericUsername } from "../_utils/user";
import { isDevBypassTurnstileEnabled } from "../_utils/runtimeEnv";
import { getTurnstileSecretFromEnv, verifyTurnstileToken } from "../_utils/turnstile";

export async function POST(request: Request) {
  const { username, email, password, emailCode, turnstileToken } =
    (await request.json()) as {
    username?: string;
    email: string;
    password: string;
    emailCode?: string;
    turnstileToken?: string;
  };

  if (!email || !password) {
    return new Response("邮箱和密码不能为空", { status: 400 });
  }

  if (!emailCode) {
    return new Response("请先完成邮箱验证码验证", { status: 400 });
  }

  if (!isValidEmail(email)) {
    return new Response("邮箱格式不正确", { status: 400 });
  }

  if (password.length < 6) {
    return new Response("密码长度不能少于 6 位", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const bypassTurnstile = isDevBypassTurnstileEnabled(env);
  if (!bypassTurnstile) {
    const secret = getTurnstileSecretFromEnv(env);
    if (!secret) {
      return new Response("Turnstile 未配置（缺少 TURNSTILE_SECRET_KEY）", {
        status: 500,
      });
    }

    if (!turnstileToken) {
      return new Response("请完成人机验证", { status: 400 });
    }

    const remoteip = request.headers.get("CF-Connecting-IP");
    const okTurnstile = await verifyTurnstileToken({
      secret,
      token: turnstileToken,
      remoteip,
    });

    if (!okTurnstile) {
      return new Response("人机验证失败，请重试", { status: 400 });
    }
  }

  const okCode = await verifyAndUseEmailCode({
    db,
    email,
    code: emailCode,
    purpose: "register",
  });

  if (!okCode) {
    return new Response("邮箱验证码错误或已过期", { status: 400 });
  }

  const password_hash = await sha256(password);

  try {
    const providedUsername = typeof username === "string" ? username.trim() : "";
    let finalUsername = providedUsername || generateNumericUsername(10);
    let inserted = false;

    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await db
          .prepare(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)"
          )
          .bind(finalUsername, email, password_hash)
          .run();
        inserted = true;
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);

        if (msg.includes("UNIQUE constraint failed: users.email")) {
          throw e;
        }

        if (msg.includes("UNIQUE constraint failed: users.username")) {
          if (providedUsername) {
            return new Response("用户名已被占用", { status: 400 });
          }

          // 自动生成的用户名碰撞：重试
          finalUsername = generateNumericUsername(10);
          continue;
        }

        throw e;
      }
    }

    if (!inserted) {
      return new Response("生成用户名失败，请稍后再试", { status: 500 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    if (msg.includes("UNIQUE constraint failed: users.email")) {
      return new Response("邮箱已被注册", { status: 400 });
    }

    console.error("注册用户失败:", e);
    return new Response("注册失败，请稍后再试", { status: 500 });
  }

  return Response.json({ ok: true });
}
