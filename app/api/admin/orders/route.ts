import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireAdminFromRequest } from "../_utils/adminSession";

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

async function ensureOrderTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        order_no TEXT,
        order_created_time TEXT,
        order_paid_time TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    )
    .run();

  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_user_orders_user ON user_orders (user_id)"
    )
    .run();

  // 与用户端保持一致，尝试为旧表补齐字段（如果已经存在则忽略错误）
  try {
    await db.prepare("ALTER TABLE user_orders ADD COLUMN order_no TEXT").run();
  } catch {}
  try {
    await db
      .prepare("ALTER TABLE user_orders ADD COLUMN order_created_time TEXT")
      .run();
  } catch {}
  try {
    await db
      .prepare("ALTER TABLE user_orders ADD COLUMN order_paid_time TEXT")
      .run();
  } catch {}
}

// 管理端查看所有用户的订单截图（可按邮箱 / 设备 ID 过滤，最多返回最近 200 条）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userEmail = searchParams.get("userEmail");
  const deviceId = searchParams.get("deviceId");

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureOrderTable(db);

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
      o.order_paid_time
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
    })) ?? [];

  return Response.json({ items });
}


