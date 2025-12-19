import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * 从 R2 存储中读取头像图片
 *
 * 查询参数：
 * - key: R2 对象的 key（必需，必须以 avatars/ 开头）
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key) {
    return new Response("Missing key parameter", { status: 400 });
  }

  // 安全检查：确保 key 以 avatars/ 开头，防止访问其他文件
  if (!key.startsWith("avatars/")) {
    return new Response("Invalid key", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  // 复用现有 R2 bucket（订单截图已使用该 bucket）
  const r2 = env.ORDER_IMAGES as R2Bucket;

  const object = await r2.get(key);
  if (!object) {
    return new Response("Image not found", { status: 404 });
  }

  const headers = new Headers();
  const contentType = object.httpMetadata?.contentType || "image/png";
  headers.set("Content-Type", contentType);
  headers.set("ETag", object.httpEtag);
  // 头像对象 key 每次上传都是唯一的，可长期缓存
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}


