import { getCloudflareContext } from "@opennextjs/cloudflare";

type OrderRow = {
  id: number;
  user_id: number;
  device_id: string;
  image_url: string;
  note: string | null;
  created_at: string;
  // 下面字段为可选扩展字段，用于保存从截图中解析出的订单信息
  order_no?: string | null;
  order_created_time?: string | null;
  order_paid_time?: string | null;
  platform?: string | null;
  shop_name?: string | null;
  device_count?: number | null;
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
  recognizeFailed: string;
  duplicateOrderNo: string;
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
      recognizeFailed:
        "Failed to recognize order information from the screenshot. Please upload a clearer order or invoice image.",
      duplicateOrderNo:
        "This order number has already been uploaded. Please do not submit duplicate orders.",
    };
  }

  // 默认中文
  return {
    missingEmail: "邮箱不能为空",
    missingDeviceImage: "缺少图片文件",
    missingOrderId: "缺少订单 ID",
    userNotFound: "用户不存在",
    deleteNotFoundOrNotOwned: "订单不存在或不属于当前用户",
    recognizeFailed:
      "未能从图片中识别出订单信息，请上传更清晰的订单或发票截图。",
    duplicateOrderNo: "该订单号已经上传过，请不要重复提交。",
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
        order_paid_time TEXT,
        platform TEXT,
        shop_name TEXT,
        device_count INTEGER
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
  try {
    await db
      .prepare("ALTER TABLE user_orders ADD COLUMN platform TEXT")
      .run();
  } catch {}
  try {
    await db
      .prepare("ALTER TABLE user_orders ADD COLUMN shop_name TEXT")
      .run();
  } catch {}
  try {
    await db
      .prepare("ALTER TABLE user_orders ADD COLUMN device_count INTEGER")
      .run();
  } catch {}
}

type ParsedOrderInfo = {
  orderNo: string | null;
  orderCreatedTime: string | null;
  orderPaidTime: string | null;
  platform: string | null;
  shopName: string | null;
  deviceCount: number | null;
};

/**
 * 兼容从大模型返回的字符串中解析 JSON。
 * - 处理 ```json ... ``` 代码块包裹
 * - 抓取首个 `{ ... }` 结构
 * - 解析失败时返回 null，而不是抛异常
 */
function parseJsonFromAi(content: string): unknown | null {
  try {
    let text = content.trim();

    if (text.startsWith("```")) {
      text = text.replace(/^```[a-zA-Z]*\n?/, "");
      text = text.replace(/\n?```$/, "").trim();
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      text = match[0];
    }

    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * 使用 MoleAPI + GPT 模型直接从截图中抽取订单结构化信息。
 *
 * 需要在 Cloudflare 环境中配置（示例）:
 *   MOLE_API_KEY="sk-xxxx"
 *   MOLE_API_BASE_URL="https://api.moleapi.com/v1"   (可选，默认此值)
 *   MOLE_AI_MODEL="gpt-4o"                           (可选，默认此值)
 *
 * 未配置 MOLE_API_KEY 时，将返回 null，不影响主流程。
 */
async function extractOrderInfoFromImage(
  file: File,
  env: Record<string, unknown>
): Promise<ParsedOrderInfo | null> {
  const apiKey = env.MOLE_API_KEY as string | undefined;
  if (!apiKey) {
    return null;
  }

  const apiBaseUrl =
    (env.MOLE_API_BASE_URL as string | undefined) ??
    "https://api.moleapi.com/v1";
  const model =
    (env.MOLE_AI_MODEL as string | undefined) ?? "gpt-4o";

  try {
    // 将文件转为 base64 data URL 传给多模态模型
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = file.type || "image/jpeg";
    const imageDataUrl = `data:${mimeType};base64,${base64}`;

    const payload = {
      model,
      messages: [
        {
          role: "system",
          content:
            "你是一个专业的电商订单识别助手，只负责从图片中提取结构化字段并输出 JSON。",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "请从这张电商订单截图中提取以下字段，并严格以 JSON 返回：\n" +
                "{\n" +
                '  "platform": string | null,        // 平台名字（淘宝、京东、拼多多、抖音等）\n' +
                '  "shop_name": string | null,       // 店铺名字\n' +
                '  "order_id": string | null,        // 订单号/订单编号\n' +
                '  "order_created_at": string | null,// 订单创建时间，格式 YYYY-MM-DD HH:MM:SS\n' +
                '  "paid_at": string | null,         // 付款时间，格式 YYYY-MM-DD HH:MM:SS\n' +
                '  "device_count": number | null     // 此订单中购买的设备/商品数量\n' +
                "}\n" +
                "如果图片中缺少某个字段，就把该字段设为 null。仅返回 JSON，不要包含任何额外说明文字。",
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 300,
    };

    const res = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return null;
    }

    type MoleContentPart = { type?: string; text?: string };
    type MoleChatCompletionResponse = {
      choices?: { message?: { content?: string | MoleContentPart[] } }[];
    };

    const data = (await res.json()) as MoleChatCompletionResponse;
    const rawContent: unknown = data?.choices?.[0]?.message?.content;

    // MoleAPI 可能返回字符串，也可能返回 content 片段数组，做两种情况的兼容
    let contentText: string | null = null;
    if (typeof rawContent === "string") {
      contentText = rawContent;
    } else if (Array.isArray(rawContent)) {
      const parts = rawContent
        .filter((p) => p && typeof p === "object" && "type" in p)
        .map((p: MoleContentPart) =>
          p.type === "text" ? String(p.text ?? "") : ""
        )
        .join("\n")
        .trim();
      contentText = parts || null;
    }

    if (!contentText) {
      return null;
    }

    const parsed = parseJsonFromAi(contentText) as
      | {
          platform?: string | null;
          shop_name?: string | null;
          order_id?: string | null;
          order_created_at?: string | null;
          paid_at?: string | null;
          device_count?: number | string | null;
        }
      | null;

    if (!parsed) {
      return null;
    }

    const toPositiveIntOrNull = (value: unknown): number | null => {
      if (typeof value === "number") {
        return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
      }
      if (typeof value === "string") {
        const n = parseInt(value, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
      }
      return null;
    };

    const result: ParsedOrderInfo = {
      orderNo: parsed.order_id ?? null,
      orderCreatedTime: parsed.order_created_at ?? null,
      orderPaidTime: parsed.paid_at ?? null,
      platform: parsed.platform ?? null,
      shopName: parsed.shop_name ?? null,
      deviceCount: toPositiveIntOrNull(parsed.device_count),
    };

    return result;
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

  const sql = `SELECT id, user_id, device_id, image_url, note, created_at, order_no, order_created_time, order_paid_time, platform, shop_name, device_count
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
      platform: row.platform ?? null,
      shopName: row.shop_name ?? null,
      deviceCount: typeof row.device_count === "number" ? row.device_count : null,
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
    )) ?? null;

  // 当识别流程本身失败（例如未配置 key / 网络错误 / 返回内容不是合法 JSON）时，直接提示用户
  // 如果识别成功但字段为 null（例如截图缺少部分信息），仍然允许入库，只是这些字段为空。
  if (parsed === null) {
    return new Response(t.recognizeFailed, { status: 400 });
  }

  // 如果识别出了订单号，则不允许同一用户、同一订单号重复上传
  if (parsed.orderNo) {
    const dup = await db
      .prepare(
        "SELECT id FROM user_orders WHERE user_id = ? AND order_no = ? LIMIT 1"
      )
      .bind(user.id, parsed.orderNo)
      .all<{ id: number }>();

    if (dup.results && dup.results[0]) {
      return new Response(t.duplicateOrderNo, { status: 400 });
    }
  }

  // 这里为简单起见，将截图存为 Data URL 文本（适合小图、低频）
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = file.type || "image/png";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const insert = await db
    .prepare(
      "INSERT INTO user_orders (user_id, device_id, image_url, note, order_no, order_created_time, order_paid_time, platform, shop_name, device_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      user.id,
      deviceId,
      dataUrl,
      typeof note === "string" ? note : null,
      parsed?.orderNo ?? null,
      parsed?.orderCreatedTime ?? null,
      parsed?.orderPaidTime ?? null,
      parsed?.platform ?? null,
      parsed?.shopName ?? null,
      parsed?.deviceCount ?? null
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
    platform: parsed?.platform ?? null,
    shopName: parsed?.shopName ?? null,
    deviceCount: parsed?.deviceCount ?? null,
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

