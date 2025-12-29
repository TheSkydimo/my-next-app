import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireAdminFromRequest } from "../_utils/adminSession";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";
import { ensureUserOrdersTable } from "../../_utils/userOrdersTable";
import { createUserNotification } from "../../_utils/userNotifications";

type OrderRowWithUser = {
  id: number;
  user_email: string;
  device_id: string;
  image_url: string;
  note: string | null;
  created_at: string;
  order_no?: string | null;
  order_created_time?: string | null;
  order_paid_time?: string | null;
  platform?: string | null;
  shop_name?: string | null;
  device_count?: number | null;
};

/**
 * 将数据库中的 image_url 转换为前端可用的 URL
 * - r2:// 开头的转为 API 路径
 */
function convertImageUrl(dbUrl: string): string {
  if (dbUrl.startsWith("r2://")) {
    const r2Key = dbUrl.slice(5); // 去掉 "r2://" 前缀
    return `/api/user/orders/image?key=${encodeURIComponent(r2Key)}`;
  }
  // 不再兼容 data:（必须迁移到 R2）
  throw new Error("Legacy data: image_url detected. Please migrate to R2.");
}



// 管理端查看所有用户的订单截图（可按邮箱 / 设备 ID 过滤，最多返回最近 200 条）
export const GET = withApiMonitoring(async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userEmail = (searchParams.get("userEmail") ?? "").trim() || null;
  const deviceId = (searchParams.get("deviceId") ?? "").trim() || null;

  // Input hardening (avoid very large strings / log/DB abuse).
  if (userEmail && userEmail.length > 320) {
    return new Response("Invalid userEmail", { status: 400 });
  }
  if (deviceId && deviceId.length > 120) {
    return new Response("Invalid deviceId", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureUserOrdersTable(db);

  const whereParts: string[] = [];
  const bindValues: unknown[] = [];

  if (userEmail) {
    whereParts.push("u.email = ?");
    bindValues.push(userEmail);
  }

  if (deviceId) {
    whereParts.push("o.device_id = ?");
    bindValues.push(deviceId);
  }

  const whereSql =
    whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const sql = `SELECT
      o.id,
      u.email AS user_email,
      o.device_id,
      o.image_url,
      o.note,
      o.created_at,
      o.order_no,
      o.order_created_time,
      o.order_paid_time,
      o.platform,
      o.shop_name,
      o.device_count
    FROM user_orders o
    JOIN users u ON o.user_id = u.id
    ${whereSql}
    ORDER BY o.created_at DESC
    LIMIT 200`;

  const { results } = await db.prepare(sql).bind(...bindValues).all<OrderRowWithUser>();

  // 强制只走 R2：如果存在遗留 data:，要求先执行迁移
  if (results?.some((r) => typeof r.image_url === "string" && r.image_url.startsWith("data:"))) {
    return new Response(
      "检测到遗留的 data: 图片数据，请先迁移到 R2（管理员接口：/api/admin/migrations/data-to-r2）",
      { status: 409 }
    );
  }

  const items =
    results?.map((row) => ({
      id: row.id,
      userEmail: row.user_email,
      deviceId: row.device_id,
      imageUrl: convertImageUrl(row.image_url),
      note: row.note,
      createdAt: row.created_at,
      orderNo: row.order_no ?? null,
      orderCreatedTime: row.order_created_time ?? null,
      orderPaidTime: row.order_paid_time ?? null,
      platform: row.platform ?? null,
      shopName: row.shop_name ?? null,
      deviceCount: typeof row.device_count === "number" ? row.device_count : null,
    })) ?? [];

  return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
}, { name: "GET /api/admin/orders" });

function maskOrderNo(orderNo: string | null | undefined): string {
  const s = String(orderNo ?? "").trim();
  if (!s) return "";
  if (s.length <= 8) return s;
  return `${s.slice(0, 3)}****${s.slice(-3)}`;
}

type DeleteBody = { id?: number };

export const DELETE = withApiMonitoring(async function DELETE(request: Request) {
  let body: DeleteBody;
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    return new Response("请求体格式不正确", { status: 400 });
  }

  const id = body.id;
  if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) {
    return new Response("缺少订单 ID", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  const r2 = env.ORDER_IMAGES as R2Bucket;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureUserOrdersTable(db);

  const q = await db
    .prepare("SELECT user_id, image_url, order_no, upload_lang FROM user_orders WHERE id = ? LIMIT 1")
    .bind(id)
    .all<{ user_id: number; image_url: string; order_no: string | null; upload_lang: string | null }>();

  const row = q.results?.[0];
  if (!row) {
    return new Response("订单不存在", { status: 404 });
  }

  if (typeof row.image_url === "string" && row.image_url.startsWith("r2://")) {
    const r2Key = row.image_url.slice(5);
    try {
      await r2.delete(r2Key);
    } catch {
      // best-effort
      console.error("admin delete order: failed to delete r2 object");
    }
  }

  const del = await db.prepare("DELETE FROM user_orders WHERE id = ?").bind(id).run();
  const changes = (del.meta.changes ?? 0) as number;
  if (changes === 0) {
    return new Response("订单不存在", { status: 404 });
  }

  // 通知用户端：订单截图被移除（best-effort，不阻断删除流程）
  try {
    const orderNoMasked = maskOrderNo(row.order_no);
    const langKey = String(row.upload_lang ?? "").toLowerCase() === "en" ? "en" : "zh";
    const zhBody = orderNoMasked
      ? `你的订单截图已被移除（订单号：${orderNoMasked}）。如有疑问请联系客服。`
      : "你的订单截图已被移除。如有疑问请联系客服。";
    const enBody = orderNoMasked
      ? `Your order screenshot has been removed (Order No: ${orderNoMasked}). If you have questions, please contact support.`
      : "Your order screenshot has been removed. If you have questions, please contact support.";
    await createUserNotification({
      db,
      userId: row.user_id,
      type: "order_removed",
      level: "warn",
      audienceLang: langKey === "en" ? "en" : "zh",
      // legacy fallback (kept consistent with chosen language)
      title: langKey === "en" ? "Order screenshot removed" : "订单截图已被移除",
      body: langKey === "en" ? enBody : zhBody,
      // language-specific fields used by inbox rendering
      titleZh: langKey === "zh" ? "订单截图已被移除" : null,
      bodyZh: langKey === "zh" ? zhBody : null,
      titleEn: langKey === "en" ? "Order screenshot removed" : null,
      bodyEn: langKey === "en" ? enBody : null,
      meta: {
        orderId: id,
        orderNoMasked: orderNoMasked || null,
        removedByAdminId: authed.admin.id,
        uploadLang: langKey,
      },
    });
  } catch {
    console.error("admin delete order: notify user failed");
  }

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}, { name: "DELETE /api/admin/orders" });


