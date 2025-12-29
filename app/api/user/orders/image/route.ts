import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireUserFromRequest } from "../../_utils/userSession";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";
import { ensureUserOrdersTable } from "../../../_utils/userOrdersTable";

/**
 * 从 R2 存储中读取订单图片
 * 
 * 查询参数：
 * - key: R2 对象的 key（必需）
 * 
 * 返回：
 * - 图片二进制流，带正确的 Content-Type
 * - 设置缓存头以提高性能
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

  // 安全检查：确保 key 以 orders/ 开头，防止访问其他文件
  if (!key.startsWith("orders/")) {
    return new Response("Invalid key", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  const r2 = env.ORDER_IMAGES as R2Bucket;

  await ensureUserOrdersTable(db);

  // 必须登录；普通用户只能读取自己的订单截图；管理员可读取任意用户订单截图。
  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  // 归属校验：确保该 key 在 DB 中确实属于当前用户（或管理员）
  const dbUrl = `r2://${key}`;
  const ownerRes = await db
    .prepare("SELECT user_id FROM user_orders WHERE image_url = ? LIMIT 1")
    .bind(dbUrl)
    .all<{ user_id: number }>();
  const owner = ownerRes.results?.[0]?.user_id ?? null;

  if (owner == null) {
    // 不暴露对象是否存在于 R2（避免枚举），统一当作不存在
    return new Response("Image not found", { status: 404 });
  }

  if (!authed.user.isAdmin && owner !== authed.user.id) {
    // Privacy: avoid leaking ownership/existence across users.
    return new Response("Image not found", { status: 404 });
  }

  const object = await r2.get(key);

  if (!object) {
    return new Response("Image not found", { status: 404 });
  }

  // 构建响应头
  const headers = new Headers();
  
  // 设置 Content-Type
  const contentType = object.httpMetadata?.contentType || "image/png";
  headers.set("Content-Type", contentType);
  
  // 设置 ETag 用于缓存验证
  headers.set("ETag", object.httpEtag);
  
  // Privacy: do not store order images in caches by default.
  headers.set("Cache-Control", "no-store");

  return new Response(object.body, { headers });
}, { name: "GET /api/user/orders/image" });

