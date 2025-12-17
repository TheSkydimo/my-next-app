import { getCloudflareContext } from "@opennextjs/cloudflare";

type OrderRow = {
  id: number;
  user_id: number;
  device_id: string;
  image_url: string;
  note: string | null;
  created_at: string;
  // 下面三个字段为可选扩展字段，用于保存从截图中解析出的订单信息
  order_no?: string | null;
  order_created_time?: string | null;
  order_paid_time?: string | null;
};

// 当上传订单截图时，如果前端未提供设备 ID，则使用该占位值入库。
// 这样既不破坏现有 NOT NULL 约束，又方便后续在管理端筛选「未绑定设备」的订单。
const DEFAULT_DEVICE_ID = "__NO_DEVICE__";

// ---- API 级别国际化（仅负责本接口的错误文案） ----
type ApiLanguage = "zh-CN" | "en-US";

type UserOrderApiMessages = {
  missingEmail: string;
  missingDeviceImage: string;
  missingOrderId: string;
  userNotFound: string;
  deleteNotFoundOrNotOwned: string;
};

function detectApiLanguage(request: Request): ApiLanguage {
  const url = new URL(request.url);
  const langParam = url.searchParams.get("lang");

  if (langParam === "zh-CN" || langParam === "en-US") {
    return langParam;
  }

  const header = request.headers.get("accept-language")?.toLowerCase() ?? "";
  if (header.startsWith("en")) {
    return "en-US";
  }

  return "zh-CN";
}

function getUserOrderApiMessages(lang: ApiLanguage): UserOrderApiMessages {
  if (lang === "en-US") {
    return {
      missingEmail: "Email is required",
      missingDeviceImage: "Screenshot file is required",
      missingOrderId: "Order ID is required",
      userNotFound: "User not found",
      deleteNotFoundOrNotOwned:
        "Order does not exist or does not belong to the current user",
    };
  }

  // 默认中文
  return {
    missingEmail: "邮箱不能为空",
    missingDeviceImage: "缺少图片文件",
    missingOrderId: "缺少订单 ID",
    userNotFound: "用户不存在",
    deleteNotFoundOrNotOwned: "订单不存在或不属于当前用户",
  };
}

async function ensureOrderTable(db: D1Database) {
  // 尽量保持 SQL 简单，避免某些 D1 运行时对复杂约束解析失败
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
        order_paid_time TEXT
      )`
    )
    .run();

  await db
    .prepare("CREATE INDEX IF NOT EXISTS idx_user_orders_user ON user_orders (user_id)")
    .run();

  // 对于已经存在的表，尝试补充缺失字段（如果字段已存在，忽略错误）
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

type ParsedOrderInfo = {
  orderNo: string | null;
  orderCreatedTime: string | null;
  orderPaidTime: string | null;
};

/**
 * 从 OCR 文本中解析订单号 / 创建时间 / 付款时间。
 * 文本示例：
 *   创建时间：2025-10-17 16:28:56
 *   付款时间：2025-10-17 16:29:01
 *   订单号: 3000134318690798656
 */
function parseOrderInfoFromText(text: string): ParsedOrderInfo {
  const createdMatch =
    text.match(/创建时间[:：]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
  const paidMatch =
    text.match(/付款时间[:：]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
  const orderNoMatch = text.match(/订单号[:：]?\s*([0-9]{10,})/);

  return {
    orderNo: orderNoMatch?.[1] ?? null,
    orderCreatedTime: createdMatch?.[1] ?? null,
    orderPaidTime: paidMatch?.[1] ?? null,
  };
}

/**
 * 使用第三方 OCR 服务从图片中提取文本，再解析订单信息。
 *
 * 当前实现使用 OCR.space API，需在 Cloudflare 环境中配置：
 *   OCR_SPACE_API_KEY=<你的 api key>
 *
 * 如果未配置，将直接返回 null，不影响主流程。
 */
async function extractOrderInfoFromImage(
  file: File,
  env: Record<string, unknown>
): Promise<ParsedOrderInfo | null> {
  const apiKey = env.OCR_SPACE_API_KEY as string | undefined;
  if (!apiKey) {
    // 未配置 OCR key，跳过自动识别
    return null;
  }

  const formData = new FormData();
  formData.append("apikey", apiKey);
  // 中文截图为主
  formData.append("language", "chs");
  formData.append("isOverlayRequired", "false");
  formData.append("scale", "true");
  formData.append("OCREngine", "2");
  formData.append("file", file);

  try {
    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as {
      ParsedResults?: { ParsedText?: string }[];
      IsErroredOnProcessing?: boolean;
    };

    if (data.IsErroredOnProcessing || !data.ParsedResults?.[0]?.ParsedText) {
      return null;
    }

    const text = data.ParsedResults[0].ParsedText;
    return parseOrderInfoFromText(text);
  } catch {
    // 网络或解析异常时，静默失败，不阻断主流程
    return null;
  }
}

// 获取当前用户的订单截图列表（按设备可选过滤）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const deviceId = searchParams.get("deviceId");

  const lang = detectApiLanguage(request);
  const t = getUserOrderApiMessages(lang);

  if (!email) {
    return new Response(t.missingEmail, { status: 400 });
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
    return new Response(t.userNotFound, { status: 404 });
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
      orderNo: row.order_no ?? null,
      orderCreatedTime: row.order_created_time ?? null,
      orderPaidTime: row.order_paid_time ?? null,
    })) ?? [];

  return Response.json({ items });
}

// 上传订单截图（当前实现：将图片以 Data URL 文本形式直接存入数据库）
// 注意：适用于早期小规模使用，如后续图片增多，请迁移到 R2 等对象存储，仅在表中保存 URL。
export async function POST(request: Request) {
  const lang = detectApiLanguage(request);
  const t = getUserOrderApiMessages(lang);

  const form = await request.formData();
  const email = form.get("email");
  const rawDeviceId = form.get("deviceId");
  const file = form.get("file");
  const note = form.get("note");

  if (typeof email !== "string" || !email) {
    return new Response(t.missingEmail, { status: 400 });
  }
  if (!(file instanceof File)) {
    return new Response(t.missingDeviceImage, { status: 400 });
  }

  // 设备 ID 现在是可选的：
  // - 若前端传了非空字符串，则按原样使用；
  // - 若未传或为空，则使用占位 ID，表示「未绑定设备」。
  const deviceId =
    typeof rawDeviceId === "string" && rawDeviceId.trim()
      ? rawDeviceId.trim()
      : DEFAULT_DEVICE_ID;

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  await ensureOrderTable(db);

  const userQuery = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .all<{ id: number }>();

  const user = userQuery.results?.[0];
  if (!user) {
    return new Response(t.userNotFound, { status: 404 });
  }

  // 在将截图入库前，尝试做一次 OCR 识别，提取订单号与时间信息
  const parsed =
    (await extractOrderInfoFromImage(
      file,
      env as unknown as Record<string, unknown>
    )) ??
    null;

  // 这里为简单起见，将截图存为 Data URL 文本（适合小图、低频）
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = file.type || "image/png";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const insert = await db
    .prepare(
      "INSERT INTO user_orders (user_id, device_id, image_url, note, order_no, order_created_time, order_paid_time) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      user.id,
      deviceId,
      dataUrl,
      typeof note === "string" ? note : null,
      parsed?.orderNo ?? null,
      parsed?.orderCreatedTime ?? null,
      parsed?.orderPaidTime ?? null
    )
    .run();

  const insertedId = insert.meta.last_row_id as number;

  return Response.json({
    id: insertedId,
    deviceId,
    imageUrl: dataUrl,
    note: typeof note === "string" ? note : null,
    orderNo: parsed?.orderNo ?? null,
    orderCreatedTime: parsed?.orderCreatedTime ?? null,
    orderPaidTime: parsed?.orderPaidTime ?? null,
    // 前端展示用时间，真实入库时间仍由数据库默认值生成
    createdAt: new Date().toISOString(),
  });
}

// 删除指定订单截图（仅允许删除当前用户自己的记录）
export async function DELETE(request: Request) {
  const lang = detectApiLanguage(request);
  const t = getUserOrderApiMessages(lang);

  const body = (await request.json()) as {
    email?: string;
    id?: number;
  };

  const { email, id } = body;

  if (!email) {
    return new Response(t.missingEmail, { status: 400 });
  }
  if (typeof id !== "number") {
    return new Response(t.missingOrderId, { status: 400 });
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
    return new Response(t.userNotFound, { status: 404 });
  }

  const result = await db
    .prepare("DELETE FROM user_orders WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .run();

  const changes = (result.meta.changes ?? 0) as number;
  if (changes === 0) {
    return new Response(t.deleteNotFoundOrNotOwned, { status: 404 });
  }

  return Response.json({ success: true });
}

