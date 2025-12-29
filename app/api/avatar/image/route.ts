import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireUserFromRequest } from "../../user/_utils/userSession";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

/**
 * 从 R2 存储中读取头像图片
 *
 * 查询参数：
 * - key: R2 对象的 key（必需，必须以 avatars/ 开头）
 */
export const GET = withApiMonitoring(async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key) {
    return new Response("Missing key parameter", { status: 400 });
  }

  // Basic hardening: cap key length.
  if (key.length > 512) {
    return new Response("Invalid key", { status: 400 });
  }

  // 安全检查：确保 key 以 avatars/ 开头，防止访问其他文件
  if (!key.startsWith("avatars/")) {
    return new Response("Invalid key", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  // 复用现有 R2 bucket（订单截图已使用该 bucket）
  const r2 = env.ORDER_IMAGES as R2Bucket;

  // Privacy: avatar should be readable only by the owner (or admins).
  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  const ownerId = (() => {
    const parts = key.split("/");
    const idStr = parts[1] ?? "";
    const n = Number.parseInt(idStr, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  if (ownerId == null) return new Response("Invalid key", { status: 400 });

  // Non-admin users can only access their own avatars. Return 404 to avoid user enumeration.
  if (!authed.user.isAdmin && authed.user.id !== ownerId) {
    return new Response("Image not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const object = await r2.get(key);
  if (!object) {
    return new Response("Image not found", { status: 404 });
  }

  const headers = new Headers();
  const contentType = object.httpMetadata?.contentType || "image/png";
  headers.set("Content-Type", contentType);
  headers.set("ETag", object.httpEtag);
  // Privacy: do not store user avatars in caches by default.
  headers.set("Cache-Control", "no-store");

  return new Response(object.body, { headers });
}, { name: "GET /api/avatar/image" });


