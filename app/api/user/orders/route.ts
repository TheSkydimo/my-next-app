import { getCloudflareContext } from "@opennextjs/cloudflare";

type OrderRow = {
  id: number;
  user_id: number;
  device_id: string;
  image_url: string;
  note: string | null;
  created_at: string;
};

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
    .prepare("CREATE INDEX IF NOT EXISTS idx_user_orders_user ON user_orders (user_id)")
    .run();
}

// 获取当前用户的订单截图列表（按设备可选过滤）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const deviceId = searchParams.get("deviceId");

  if (!email) {
    return new Response("缺少 email 参数", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  await ensureOrderTable(db);

  const userQuery = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .all<{ id: number }>();

  const user = userQuery.results?.[0];
  if (!user) {
    return new Response("用户不存在", { status: 404 });
  }

  const whereParts = ["user_id = ?"];
  const bindValues: unknown[] = [user.id];

  if (deviceId) {
    whereParts.push("device_id = ?");
    bindValues.push(deviceId);
  }

  const sql = `SELECT id, user_id, device_id, image_url, note, created_at
    FROM user_orders
    WHERE ${whereParts.join(" AND ")}
    ORDER BY created_at DESC`;

  const { results } = await db.prepare(sql).bind(...bindValues).all<OrderRow>();

  const items =
    results?.map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      imageUrl: row.image_url,
      note: row.note,
      createdAt: row.created_at,
    })) ?? [];

  return Response.json({ items });
}

// 上传订单截图（当前实现：将图片以 Data URL 文本形式直接存入数据库）
// 注意：适用于早期小规模使用，如后续图片增多，请迁移到 R2 等对象存储，仅在表中保存 URL。
export async function POST(request: Request) {
  const form = await request.formData();
  const email = form.get("email");
  const deviceId = form.get("deviceId");
  const file = form.get("file");
  const note = form.get("note");

  if (typeof email !== "string" || !email) {
    return new Response("邮箱不能为空", { status: 400 });
  }
  if (typeof deviceId !== "string" || !deviceId) {
    return new Response("设备 ID 不能为空", { status: 400 });
  }
  if (!(file instanceof File)) {
    return new Response("缺少图片文件", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  await ensureOrderTable(db);

  const userQuery = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .all<{ id: number }>();

  const user = userQuery.results?.[0];
  if (!user) {
    return new Response("用户不存在", { status: 404 });
  }

  // 这里为简单起见，将截图存为 Data URL 文本（适合小图、低频）
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = file.type || "image/png";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const insert = await db
    .prepare(
      "INSERT INTO user_orders (user_id, device_id, image_url, note) VALUES (?, ?, ?, ?)"
    )
    .bind(user.id, deviceId, dataUrl, typeof note === "string" ? note : null)
    .run();

  const insertedId = insert.meta.last_row_id as number;

  return Response.json({
    id: insertedId,
    deviceId,
    imageUrl: dataUrl,
    note: typeof note === "string" ? note : null,
  });
}


