import { getCloudflareContext } from "@opennextjs/cloudflare";

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

async function assertAdmin(db: D1Database, adminEmail: string | null) {
  if (!adminEmail) {
    return new Response("缺少管理员邮箱", { status: 401 });
  }

  const { results } = await db
    .prepare("SELECT id FROM users WHERE email = ? AND is_admin = 1")
    .bind(adminEmail)
    .all();

  if (!results || results.length === 0) {
    return new Response("无权访问：不是管理员账号", { status: 403 });
  }

  return null;
}

/**
 * 将数据库中的 image_url 转换为前端可用的 URL
 * - r2:// 开头的转为 API 路径
 * - data: 开头的保持不变（兼容旧数据）
 */
function convertImageUrl(dbUrl: string): string {
  if (dbUrl.startsWith("r2://")) {
    const r2Key = dbUrl.slice(5); // 去掉 "r2://" 前缀
    return `/api/user/orders/image?key=${encodeURIComponent(r2Key)}`;
  }
  // 兼容旧的 data URL 格式
  return dbUrl;
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
  const adminEmail = searchParams.get("adminEmail");
  const userEmail = searchParams.get("userEmail");
  const deviceId = searchParams.get("deviceId");

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authError = await assertAdmin(db, adminEmail);
  if (authError) return authError;

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


