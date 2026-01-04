import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireUserFromRequest } from "../_utils/userSession";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";
import { normalizeDbUtcDateTimeToIso } from "../../_utils/dbTime";
import { ensureUserOrdersTable } from "../../_utils/userOrdersTable";

type DeviceRow = {
  id: number;
  device_id: string;
  warranty_expires_at: string;
};

type Device = {
  id: number;
  deviceId: string;
  warrantyExpiresAt: string;
};

type OrderRow = {
  id: number;
  user_id: number;
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

type OrderSnapshot = {
  id: number;
  deviceId: string;
  imageUrl: string;
  note: string | null;
  createdAt: string;
  orderNo?: string | null;
  orderCreatedTime?: string | null;
  orderPaidTime?: string | null;
  platform?: string | null;
  shopName?: string | null;
  deviceCount?: number | null;
};

function withNoStore(res: Response) {
  const next = new Response(res.body, res);
  next.headers.set("Cache-Control", "no-store");
  return next;
}

async function ensureUserDevicesTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        warranty_expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run();

  // 保持与 /api/user/devices GET 一致：兼容旧数据，清重再建唯一索引
  await db
    .prepare(
      `DELETE FROM user_devices
       WHERE id NOT IN (
         SELECT MIN(id) FROM user_devices GROUP BY user_id, device_id
       )`
    )
    .run();

  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_user_device ON user_devices (user_id, device_id)"
    )
    .run();
}

function convertOrderImageUrl(dbUrl: string): string {
  if (dbUrl.startsWith("r2://")) {
    const r2Key = dbUrl.slice(5);
    return `/api/user/orders/image?key=${encodeURIComponent(r2Key)}`;
  }
  // 与 /api/user/orders 保持一致：不兼容 data:；遇到遗留数据交由原接口返回 409
  throw new Error("Legacy data: image_url detected. Please migrate to R2.");
}

async function loadDevicesPage1(db: D1Database, userId: number) {
  const page = 1;
  const pageSize = 5;
  const offset = 0;

  const devicesQuery = await db
    .prepare(
      "SELECT id, device_id, warranty_expires_at FROM user_devices WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
    )
    .bind(userId, pageSize, offset)
    .all<DeviceRow>();

  const countQuery = await db
    .prepare("SELECT COUNT(*) as count FROM user_devices WHERE user_id = ?")
    .bind(userId)
    .all<{ count: number }>();

  const total = countQuery.results?.[0]?.count ?? 0;

  const items: Device[] =
    devicesQuery.results?.map((d) => ({
      id: d.id,
      deviceId: d.device_id,
      warrantyExpiresAt: d.warranty_expires_at,
    })) ?? [];

  return {
    items,
    page,
    pageSize,
    total,
    hasNextPage: page * pageSize < total,
  };
}

async function loadOrders(db: D1Database, userId: number) {
  const { results } = await db
    .prepare(
      "SELECT id, user_id, device_id, image_url, note, created_at, order_no, order_created_time, order_paid_time, platform, shop_name, device_count FROM user_orders WHERE user_id = ? ORDER BY created_at DESC"
    )
    .bind(userId)
    .all<OrderRow>();

  // 与 /api/user/orders 保持一致：若存在遗留 data:，不预加载（避免改变页面原本的错误/提示行为）
  if (
    results?.some(
      (r) => typeof r.image_url === "string" && r.image_url.startsWith("data:")
    )
  ) {
    return { ok: false as const, reason: "legacy-data" as const };
  }

  const list: OrderSnapshot[] =
    results?.map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      imageUrl: convertOrderImageUrl(row.image_url),
      note: row.note,
      createdAt: normalizeDbUtcDateTimeToIso(row.created_at) ?? row.created_at,
      orderNo: row.order_no ?? null,
      orderCreatedTime: row.order_created_time ?? null,
      orderPaidTime: row.order_paid_time ?? null,
      platform: row.platform ?? null,
      shopName: row.shop_name ?? null,
      deviceCount: typeof row.device_count === "number" ? row.device_count : null,
    })) ?? [];

  return { ok: true as const, items: list };
}

/**
 * 用户侧 Dashboard 一次性预加载接口（只新增，不改现有接口）
 * - 基于 httpOnly session cookie 鉴权，避免 email 参数导致越权风险
 * - 返回的数据结构用于客户端“暖缓存”，页面仍可按原逻辑直接调用旧 API
 * - Cache-Control: no-store（避免把用户数据缓存到边缘）
 */
export const GET = withApiMonitoring(async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return withNoStore(authed);

  await ensureUserDevicesTable(db);
  await ensureUserOrdersTable(db);

  const [devicesPage1, orders] = await Promise.all([
    loadDevicesPage1(db, authed.user.id),
    loadOrders(db, authed.user.id),
  ]);

  return withNoStore(
    Response.json({
      ok: true,
      // Minimal identity snapshot (avoid relying on it for auth; client should call /api/user/me when needed).
      user: {
        id: authed.user.id,
        username: authed.user.username,
        avatarUrl: authed.user.avatarUrl,
        isAdmin: authed.user.isAdmin,
      },
      // Provide exact URL -> JSON seeds so the client can do cache-first without leaking email params.
      cacheSeed: {
        "/api/user/devices?page=1": devicesPage1,
        ...(orders.ok ? { "/api/user/orders": { items: orders.items } } : {}),
      },
      preloaded: {
        devicesPage1,
        orders: orders.ok ? { items: orders.items } : null,
      },
    })
  );
}, { name: "GET /api/user/dashboard-bootstrap" });


