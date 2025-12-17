import { getCloudflareContext } from "@opennextjs/cloudflare";

type OrderRowWithUser = {
  id: number;
  user_email: string;
  device_id: string;
  image_url: string;
  note: string | null;
  created_at: string;
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
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    )
    .run();

  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_user_orders_user ON user_orders (user_id)"
    )
    .run();
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
      o.created_at
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
      imageUrl: row.image_url,
      note: row.note,
      createdAt: row.created_at,
    })) ?? [];

  return Response.json({ items });
}


