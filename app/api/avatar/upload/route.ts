import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  makeAvatarImageApiUrlFromR2Key,
  makeR2SchemeUrl,
} from "../../_utils/r2ObjectUrls";
import { requireUserFromRequest } from "../../user/_utils/userSession";

/**
 * 上传头像到 R2（对象存储），并返回：
 * - dbUrl: r2://{key}   (建议写入数据库)
 * - publicUrl: /api/avatar/image?key=...  (前端可直接展示)
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  // 与前端保持一致：最大 2MB（移动端相册/相机图片通常会超过 300KB）
  const MAX_BYTES = 2 * 1024 * 1024;
  const ALLOWED_MIME = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/avif",
  ]);

  let mimeType = "image/png";
  let buffer: ArrayBuffer | null = null;

  // 支持两种上传方式：
  // 1) multipart/form-data: file
  // 2) application/json: { dataUrl: "data:image/jpeg;base64,..." } 或 { base64, mimeType }
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as
      | { dataUrl?: string; base64?: string; mimeType?: string }
      | null;

    const dataUrl = typeof body?.dataUrl === "string" ? body.dataUrl.trim() : "";
    const rawBase64 = typeof body?.base64 === "string" ? body.base64.trim() : "";

    let base64 = "";
    if (dataUrl) {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return new Response("Invalid dataUrl format", { status: 400 });
      }
      mimeType = match[1] || "image/png";
      base64 = match[2] || "";
    } else if (rawBase64) {
      mimeType = (body?.mimeType || "image/png").trim();
      base64 = rawBase64;
    } else {
      return new Response("file or dataUrl is required", { status: 400 });
    }

    if (!mimeType.startsWith("image/") || !ALLOWED_MIME.has(mimeType)) {
      return new Response("Only common image types are allowed", { status: 400 });
    }

    // Base64 体积预估（避免先解码造成内存压力）
    const approxBytes = Math.floor((base64.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      return new Response("Avatar is too large (max 2MB)", { status: 400 });
    }

    const anyGlobal = globalThis as unknown as { Buffer?: typeof Buffer };
    if (!anyGlobal.Buffer) {
      return new Response("Buffer is not available in this runtime", { status: 500 });
    }

    // 注意：Buffer#buffer 可能包含偏移，需要 slice 出精确范围
    const buf = anyGlobal.Buffer.from(base64, "base64");
    if (buf.byteLength > MAX_BYTES) {
      return new Response("Avatar is too large (max 2MB)", { status: 400 });
    }
    buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } else {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return new Response("File is required", { status: 400 });
    }
    if (!file.type?.startsWith("image/") || !ALLOWED_MIME.has(file.type)) {
      return new Response("Only common image types are allowed", { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return new Response("Avatar is too large (max 2MB)", { status: 400 });
    }

    mimeType = file.type || "image/png";
    buffer = await file.arrayBuffer();
  }

  if (!buffer) {
    return new Response("Upload payload is empty", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  // 复用现有 R2 bucket（订单截图已使用该 bucket）
  const r2 = env.ORDER_IMAGES as R2Bucket;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  const ext = mimeType.split("/")[1] || "png";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const r2Key = `avatars/${authed.user.id}/${timestamp}-${random}.${ext}`;

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


