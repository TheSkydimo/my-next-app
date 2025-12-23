import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  makeAvatarImageApiUrlFromR2Key,
  makeR2SchemeUrl,
} from "../../_utils/r2ObjectUrls";
import { requireUserFromRequest } from "../user/_utils/userSession";

/**
 * 上传头像到 R2（对象存储），并返回：
 * - dbUrl: r2://{key}   (建议写入数据库)
 * - publicUrl: /api/avatar/image?key=...  (前端可直接展示)
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return new Response("File is required", { status: 400 });
  }
  if (!file.type?.startsWith("image/")) {
    return new Response("Only image files are allowed", { status: 400 });
  }

  // 与前端保持一致：最大 2MB（移动端相册/相机图片通常会超过 300KB）
  if (file.size > 2 * 1024 * 1024) {
    return new Response("Avatar is too large (max 2MB)", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  // 复用现有 R2 bucket（订单截图已使用该 bucket）
  const r2 = env.ORDER_IMAGES as R2Bucket;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  const mimeType = file.type || "image/png";
  const ext = mimeType.split("/")[1] || "png";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const r2Key = `avatars/${authed.user.id}/${timestamp}-${random}.${ext}`;

  const buffer = await file.arrayBuffer();
  await r2.put(r2Key, buffer, {
    httpMetadata: {
      contentType: mimeType,
    },
  });

  return Response.json({
    key: r2Key,
    dbUrl: makeR2SchemeUrl(r2Key),
    publicUrl: makeAvatarImageApiUrlFromR2Key(r2Key),
  });
}


