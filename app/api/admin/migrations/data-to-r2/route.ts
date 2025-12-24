import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireSuperAdminFromRequest } from "../../_utils/adminSession";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

type DataUrlParseResult =
  | { ok: true; mimeType: string; base64: string }
  | { ok: false; reason: string };

function parseBase64DataUrl(input: string): DataUrlParseResult {
  const trimmed = input.trim();
  if (!trimmed.startsWith("data:")) {
    return { ok: false, reason: "Not a data URL" };
  }

  // Example: data:image/png;base64,AAAA...
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return { ok: false, reason: "Unsupported data URL format (base64 only)" };
  }

  const mimeType = match[1]?.trim() || "";
  const base64 = match[2]?.trim() || "";
  if (!mimeType || !base64) {
    return { ok: false, reason: "Missing mimeType or base64 payload" };
  }

  return { ok: true, mimeType, base64 };
}

function fileExtFromMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized.startsWith("image/")) {
    return normalized.split("/")[1] || "png";
  }
  return "bin";
}

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  // Node-like runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyGlobal = globalThis as any;
  if (typeof anyGlobal.Buffer !== "undefined") {
    const buf = anyGlobal.Buffer.from(base64, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }

  // Worker-like runtime
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function sanitizeForR2KeySegment(value: string): string {
  const compact = value.trim().replace(/\s+/g, "-");
  const safe = compact.replace(/[^a-zA-Z0-9_-]/g, "-");
  return safe || "unknown";
}

function randomToken(len = 8): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

type MigrationBody = {
  limit?: number; // per table
  dryRun?: boolean;
};

/**
 * 将数据库中遗留的 data:base64 图片转存到 R2，并回写为 r2://{key}。
 *
 * - users.avatar_url: data:... -> r2://avatars/{userId}/legacy-...
 * - user_orders.image_url: data:... -> r2://orders/by-order-no/{orderNo}.ext (优先) or r2://orders/legacy/{id}.ext
 *
 * 安全：
 * - 仅管理员可调用；建议仅超级管理员执行
 * - R2 上传使用 onlyIf.etagDoesNotMatch="*"，避免覆盖
 */
export const POST = withApiMonitoring(async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as MigrationBody;
  const limit = Math.max(Math.min(Number(body.limit) || 50, 200), 1);
  const dryRun = !!body.dryRun;

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  const r2 = env.ORDER_IMAGES as R2Bucket;

  const authed = await requireSuperAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  // ---- migrate users.avatar_url ----
  const usersWithData = await db
    .prepare(
      "SELECT id, avatar_url FROM users WHERE avatar_url LIKE 'data:%' LIMIT ?"
    )
    .bind(limit)
    .all<{ id: number; avatar_url: string }>();

  const avatarScanned = usersWithData.results?.length ?? 0;
  let avatarMigrated = 0;
  const avatarErrors: Array<{ userId: number; reason: string }> = [];

  for (const row of usersWithData.results ?? []) {
    const parsed = parseBase64DataUrl(row.avatar_url);
    if (!parsed.ok) {
      avatarErrors.push({ userId: row.id, reason: parsed.reason });
      continue;
    }

    const ext = fileExtFromMimeType(parsed.mimeType);
    const key = `avatars/${row.id}/legacy-${Date.now()}-${randomToken()}.${ext}`;

    if (!dryRun) {
      try {
        const buffer = decodeBase64ToArrayBuffer(parsed.base64);
        await r2.put(key, buffer, {
          onlyIf: { etagDoesNotMatch: "*" },
          httpMetadata: { contentType: parsed.mimeType },
          customMetadata: { migrated_from: "data-url", user_id: String(row.id) },
        });

        await db
          .prepare("UPDATE users SET avatar_url = ? WHERE id = ?")
          .bind(`r2://${key}`, row.id)
          .run();
      } catch (e) {
        avatarErrors.push({
          userId: row.id,
          reason: e instanceof Error ? e.message : String(e),
        });
        continue;
      }
    }

    avatarMigrated += 1;
  }

  // ---- migrate user_orders.image_url ----
  // 注意：order_no 可能为空，且旧数据可能未包含扩展列；只依赖 id / image_url / order_no 即可。
  const ordersWithData = await db
    .prepare(
      "SELECT id, order_no, image_url FROM user_orders WHERE image_url LIKE 'data:%' LIMIT ?"
    )
    .bind(limit)
    .all<{ id: number; order_no: string | null; image_url: string }>();

  const orderScanned = ordersWithData.results?.length ?? 0;
  let orderMigrated = 0;
  const orderErrors: Array<{ orderId: number; reason: string }> = [];

  for (const row of ordersWithData.results ?? []) {
    const parsed = parseBase64DataUrl(row.image_url);
    if (!parsed.ok) {
      orderErrors.push({ orderId: row.id, reason: parsed.reason });
      continue;
    }

    const ext = fileExtFromMimeType(parsed.mimeType);
    const orderNo =
      typeof row.order_no === "string" && row.order_no.trim()
        ? row.order_no.trim()
        : null;

    const key = orderNo
      ? `orders/by-order-no/${sanitizeForR2KeySegment(orderNo)}.${ext}`
      : `orders/legacy/${row.id}.${ext}`;

    if (!dryRun) {
      try {
        const existing = await r2.head(key);
        if (!existing) {
          const buffer = decodeBase64ToArrayBuffer(parsed.base64);
          await r2.put(key, buffer, {
            onlyIf: { etagDoesNotMatch: "*" },
            httpMetadata: { contentType: parsed.mimeType },
            customMetadata: {
              migrated_from: "data-url",
              order_id: String(row.id),
              order_no: orderNo ?? "",
            },
          });
        }

        await db
          .prepare("UPDATE user_orders SET image_url = ? WHERE id = ?")
          .bind(`r2://${key}`, row.id)
          .run();
      } catch (e) {
        orderErrors.push({
          orderId: row.id,
          reason: e instanceof Error ? e.message : String(e),
        });
        continue;
      }
    }

    orderMigrated += 1;
  }

  // remaining counts
  const remainingAvatar = await db
    .prepare("SELECT COUNT(*) AS c FROM users WHERE avatar_url LIKE 'data:%'")
    .all<{ c: number }>();
  const remainingOrders = await db
    .prepare("SELECT COUNT(*) AS c FROM user_orders WHERE image_url LIKE 'data:%'")
    .all<{ c: number }>();

  return Response.json({
    ok: true,
    dryRun,
    limit,
    avatars: {
      scanned: avatarScanned,
      migrated: avatarMigrated,
      remaining: (remainingAvatar.results?.[0]?.c as number | undefined) ?? 0,
      errors: avatarErrors,
    },
    orders: {
      scanned: orderScanned,
      migrated: orderMigrated,
      remaining: (remainingOrders.results?.[0]?.c as number | undefined) ?? 0,
      errors: orderErrors,
    },
    next: {
      hint:
        "重复调用直到 remaining 为 0；完成后即可关闭 data: 兼容逻辑，强制只走 R2。",
    },
  });
}, { name: "POST /api/admin/migrations/data-to-r2" });


