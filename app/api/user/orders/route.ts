import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";
import { requireUserFromRequest } from "../_utils/userSession";
import { ensureUserOrdersTable } from "../../_utils/userOrdersTable";
import { assertSameOriginOrNoOrigin } from "../../_utils/requestOrigin";
import { normalizeDbUtcDateTimeToIso } from "../../_utils/dbTime";
import { isValidIanaTimeZone, tryConvertLocalYmdHmsToUtcIso } from "../../_utils/timeZone";

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
  missingDeviceImage: string;
  missingOrderId: string;
  missingOrderNo: string;
  userNotFound: string;
  deleteNotFoundOrNotOwned: string;
  recognizeFailed: string;
  duplicateOrderNo: string;
  imageTooLarge: string;
  invalidImageFile: string;
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
      missingDeviceImage: "Screenshot file is required",
      missingOrderId: "Order ID is required",
      missingOrderNo: "Order number is required",
      userNotFound: "User not found",
      deleteNotFoundOrNotOwned:
        "Order does not exist or does not belong to the current user",
      recognizeFailed:
        "Failed to recognize order information from the screenshot. Please upload a clearer order or invoice image.",
      duplicateOrderNo:
        "This order number has already been used. One order can only be submitted by one user.",
      imageTooLarge: "Image is too large (max 8MB)",
      invalidImageFile: "Invalid file type. Please upload an image file.",
    };
  }

  // 默认中文
  return {
    missingDeviceImage: "缺少图片文件",
    missingOrderId: "缺少订单 ID",
    missingOrderNo: "缺少订单号",
    userNotFound: "用户不存在",
    deleteNotFoundOrNotOwned: "订单不存在或不属于当前用户",
    recognizeFailed:
      "未能从图片中识别出订单信息，请上传更清晰的订单或发票截图。",
    duplicateOrderNo: "该订单号已被使用（一个订单只能由一个用户提交）。",
    imageTooLarge: "图片过大（最大 8MB）",
    invalidImageFile: "文件类型不正确，请上传图片文件。",
  };
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

// 获取当前用户的订单截图列表（按设备可选过滤）
export const GET = withApiMonitoring(async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceId = (searchParams.get("deviceId") ?? "").trim() || null;
  if (deviceId && deviceId.length > 120) {
    return new Response("Invalid deviceId", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureUserOrdersTable(db);

  const whereParts = ["user_id = ?"];
  const bindValues: unknown[] = [authed.user.id];

  if (deviceId) {
    whereParts.push("device_id = ?");
    bindValues.push(deviceId);
  }

  const sql = `SELECT id, user_id, device_id, image_url, note, created_at, order_no, order_created_time, order_paid_time, platform, shop_name, device_count, review_status, reviewed_at, reviewed_by, review_note
    FROM user_orders
    WHERE ${whereParts.join(" AND ")}
    ORDER BY created_at DESC`;

  const { results } = await db.prepare(sql).bind(...bindValues).all<OrderRow>();

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
      deviceId: row.device_id,
      imageUrl: convertImageUrl(row.image_url),
      note: row.note,
      createdAt: normalizeDbUtcDateTimeToIso(row.created_at) ?? row.created_at,
      orderNo: row.order_no ?? null,
      orderCreatedTime: row.order_created_time ?? null,
      orderPaidTime: row.order_paid_time ?? null,
      platform: row.platform ?? null,
      shopName: row.shop_name ?? null,
      deviceCount: typeof row.device_count === "number" ? row.device_count : null,
    })) ?? [];

  return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
}, { name: "GET /api/user/orders" });

/**
 * 为 R2 对象 Key 做安全化，避免非法字符导致路径穿越/编码问题。
 * 仅保留字母、数字、下划线、短横线；其它字符一律替换为短横线。
 */
function sanitizeOrderNoForR2Key(orderNo: string): string {
  const trimmed = orderNo.trim();
  // 将空白压缩，避免出现很怪的 key
  const compact = trimmed.replace(/\s+/g, "-");
  const safe = compact.replace(/[^a-zA-Z0-9_-]/g, "-");
  // 兜底：避免全是非法字符导致空 key
  return safe || "unknown-order";
}

/**
 * 生成 R2 对象 Key（按订单号命名，确保同一订单不会被多人共用同一张图片）。
 * 格式: orders/by-order-no/{orderNo}.{ext}
 */
function generateR2KeyByOrderNo(orderNo: string, mimeType: string): string {
  const ext = mimeType.split("/")[1] || "png";
  const safeOrderNo = sanitizeOrderNoForR2Key(orderNo);
  return `orders/by-order-no/${safeOrderNo}.${ext}`;
}

// 上传订单截图（图片存储到 R2，数据库只保存 R2 Key）
export const POST = withApiMonitoring(async function POST(request: Request) {
  const originGuard = assertSameOriginOrNoOrigin(request);
  if (originGuard) return originGuard;

  const lang = detectApiLanguage(request);
  const t = getUserOrderApiMessages(lang);

  const form = await request.formData();
  const rawDeviceId = form.get("deviceId");
  const file = form.get("file");
  const note = form.get("note");
  const rawTz = form.get("tz");
  const uploadTz =
    typeof rawTz === "string" && rawTz.trim() ? rawTz.trim() : null;
  if (uploadTz && (uploadTz.length > 64 || !isValidIanaTimeZone(uploadTz))) {
    return new Response("Invalid tz", { status: 400 });
  }

  if (!(file instanceof File)) {
    return new Response(t.missingDeviceImage, { status: 400 });
  }

  // Basic upload hardening: only allow images and cap payload size.
  // (Note: Cloudflare/Next may still have its own body limits; this is defense-in-depth.)
  const contentType = String(file.type || "");
  if (!contentType.startsWith("image/")) {
    return new Response(t.invalidImageFile, { status: 400 });
  }
  const maxBytes = 8 * 1024 * 1024; // 8MB
  if (typeof file.size === "number" && file.size > maxBytes) {
    return new Response(t.imageTooLarge, { status: 400 });
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
  const r2 = env.ORDER_IMAGES as R2Bucket;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  await ensureUserOrdersTable(db);
  const userId = authed.user.id;

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

  // 新规则：必须识别出订单号，并且「一个订单号只能被一个用户提交」
  const orderNo =
    typeof parsed.orderNo === "string" && parsed.orderNo.trim()
      ? parsed.orderNo.trim()
      : null;

  if (!orderNo) {
    return new Response(t.missingOrderNo, { status: 400 });
  }

  // Best-effort: convert OCR local time ("YYYY-MM-DD HH:MM:SS") into UTC ISO with uploader tz.
  const orderCreatedTimeIso = tryConvertLocalYmdHmsToUtcIso(
    parsed?.orderCreatedTime ?? null,
    uploadTz
  );
  const orderPaidTimeIso = tryConvertLocalYmdHmsToUtcIso(
    parsed?.orderPaidTime ?? null,
    uploadTz
  );
  const orderCreatedToStore = orderCreatedTimeIso ?? parsed?.orderCreatedTime ?? null;
  const orderPaidToStore = orderPaidTimeIso ?? parsed?.orderPaidTime ?? null;

  // 先做一次快速检查（提升 UX）；并发安全由后续“条件上传 + 条件插入”兜底
  const dupAnyUser = await db
    .prepare("SELECT id FROM user_orders WHERE order_no = ? LIMIT 1")
    .bind(orderNo)
    .all<{ id: number }>();

  if (dupAnyUser.results && dupAnyUser.results[0]) {
    return new Response(t.duplicateOrderNo, { status: 400 });
  }

  // 将图片上传到 R2
  const mimeType = file.type || "image/png";
  const r2Key = generateR2KeyByOrderNo(orderNo, mimeType);
  const buffer = await file.arrayBuffer();

  // 存储层兜底：如果 key 已存在，则拒绝覆盖，避免多人共用同一个对象 key
  try {
    await r2.put(r2Key, buffer, {
      onlyIf: { etagDoesNotMatch: "*" },
      httpMetadata: {
        contentType: mimeType,
      },
      customMetadata: {
        order_no: orderNo,
        user_id: String(userId),
      },
    });
  } catch {
    // 对象已存在/条件不满足：视为订单号已被使用
    console.error("R2 put failed");
    return new Response(t.duplicateOrderNo, { status: 400 });
  }

  // 数据库中保存 R2 Key（格式: r2://{key}），便于区分旧的 data URL 格式
  const imageUrl = `r2://${r2Key}`;

  // 并发安全：只在“订单号不存在”时插入（避免两个请求同时通过前置 SELECT）
  // 若插入失败（0 changes），需要回滚删除刚才上传的对象，避免占用 key
  const insertSql =
    "INSERT INTO user_orders (user_id, device_id, image_url, note, order_no, order_created_time, order_paid_time, platform, shop_name, device_count, upload_lang, upload_tz) " +
    "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? " +
    "WHERE NOT EXISTS (SELECT 1 FROM user_orders WHERE order_no = ?)";

  const insert = await db
    .prepare(insertSql)
    .bind(
      userId,
      deviceId,
      imageUrl,
      typeof note === "string" ? note : null,
      orderNo,
      orderCreatedToStore,
      orderPaidToStore,
      parsed?.platform ?? null,
      parsed?.shopName ?? null,
      parsed?.deviceCount ?? null,
      lang === "en-US" ? "en" : "zh",
      uploadTz,
      orderNo
    )
    .run();

  const changes = (insert.meta.changes ?? 0) as number;
  if (changes === 0) {
    // 订单号已被占用：删除刚才上传的对象（最佳努力）
    try {
      await r2.delete(r2Key);
    } catch {
      console.error("Failed to rollback R2 object");
    }
    return new Response(t.duplicateOrderNo, { status: 400 });
  }

  const insertedId = insert.meta.last_row_id as number;

  return Response.json({
    id: insertedId,
    deviceId,
    // 返回给前端的 URL 指向图片读取 API
    imageUrl: `/api/user/orders/image?key=${encodeURIComponent(r2Key)}`,
    note: typeof note === "string" ? note : null,
    orderNo,
    orderCreatedTime: orderCreatedToStore,
    orderPaidTime: orderPaidToStore,
    platform: parsed?.platform ?? null,
    shopName: parsed?.shopName ?? null,
    deviceCount: parsed?.deviceCount ?? null,
    // 前端展示用时间，真实入库时间仍由数据库默认值生成
    createdAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}, { name: "POST /api/user/orders" });

// 删除指定订单截图（仅允许删除当前用户自己的记录，同时删除 R2 中的图片）
export const DELETE = withApiMonitoring(async function DELETE(request: Request) {
  const originGuard = assertSameOriginOrNoOrigin(request);
  if (originGuard) return originGuard;

  const lang = detectApiLanguage(request);
  const t = getUserOrderApiMessages(lang);

  const body = (await request.json()) as {
    id?: number;
  };

  const { id } = body;
  if (typeof id !== "number") {
    return new Response(t.missingOrderId, { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;
  const r2 = env.ORDER_IMAGES as R2Bucket;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;
  const userId = authed.user.id;

  await ensureUserOrdersTable(db);

  // 先查询订单记录，获取 image_url 以便删除 R2 中的文件
  const orderQuery = await db
    .prepare("SELECT image_url FROM user_orders WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .all<{ image_url: string }>();

  const order = orderQuery.results?.[0];
  if (!order) {
    return new Response(t.deleteNotFoundOrNotOwned, { status: 404 });
  }

  // 如果是 R2 存储的图片，先删除 R2 中的文件
  if (order.image_url.startsWith("r2://")) {
    const r2Key = order.image_url.slice(5);
    try {
      await r2.delete(r2Key);
    } catch {
      // R2 删除失败不阻断流程，只记录错误
      console.error("Failed to delete R2 object");
    }
  }

  // 删除数据库记录
  const result = await db
    .prepare("DELETE FROM user_orders WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();

  const changes = (result.meta.changes ?? 0) as number;
  if (changes === 0) {
    return new Response(t.deleteNotFoundOrNotOwned, { status: 404 });
  }

  return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}, { name: "DELETE /api/user/orders" });


