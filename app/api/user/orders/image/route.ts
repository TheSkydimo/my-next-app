import { getCloudflareContext } from "@opennextjs/cloudflare";

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
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key) {
    return new Response("Missing key parameter", { status: 400 });
  }

  // 安全检查：确保 key 以 orders/ 开头，防止访问其他文件
  if (!key.startsWith("orders/")) {
    return new Response("Invalid key", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const r2 = env.ORDER_IMAGES as R2Bucket;

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
  
  // 设置缓存控制：私有缓存 1 天，可重新验证
  headers.set("Cache-Control", "private, max-age=86400, stale-while-revalidate=3600");

  return new Response(object.body, { headers });
}

