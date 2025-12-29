import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";
import { requireUserFromRequest } from "../_utils/userSession";
import { assertSameOriginOrNoOrigin } from "../../_utils/requestOrigin";

type DeviceRow = {
  id: number;
  device_id: string;
  warranty_expires_at: string;
};

// 获取用户设备列表
export const GET = withApiMonitoring(async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page");

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  // 确保 user_devices 表存在（兼容旧库）
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

  // 兼容旧数据：删除同一 user_id + device_id 的重复记录（保留 id 最小的一条），然后再创建唯一索引
  await db
    .prepare(
      `DELETE FROM user_devices
       WHERE id NOT IN (
         SELECT MIN(id) FROM user_devices GROUP BY user_id, device_id
       )`
    )
    .run();

  // 为 user_id + device_id 添加唯一索引，防止同一用户重复绑定同一设备
  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_user_device ON user_devices (user_id, device_id)"
    )
    .run();

  const userId = authed.user.id;

  const hasPageParam = rawPage !== null;
  const pageSize = 5;
  const pageNumber = (() => {
    if (!rawPage) return 1;
    const n = Number.parseInt(rawPage, 10);
    return Number.isNaN(n) || n < 1 ? 1 : n;
  })();

  if (hasPageParam) {
    const offset = (pageNumber - 1) * pageSize;

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

    const items =
      devicesQuery.results?.map((d) => ({
        id: d.id,
        deviceId: d.device_id,
        warrantyExpiresAt: d.warranty_expires_at,
      })) ?? [];

    return Response.json({
      items,
      page: pageNumber,
      pageSize,
      total,
      hasNextPage: pageNumber * pageSize < total,
    });
  }

  // 兼容旧接口：未传 page 参数时，返回完整数组
  const devicesQuery = await db
    .prepare(
      "SELECT id, device_id, warranty_expires_at FROM user_devices WHERE user_id = ? ORDER BY created_at DESC"
    )
    .bind(userId)
    .all<DeviceRow>();

  const devices =
    devicesQuery.results?.map((d) => ({
      id: d.id,
      deviceId: d.device_id,
      warrantyExpiresAt: d.warranty_expires_at,
    })) ?? [];

  return Response.json(devices);
}, { name: "GET /api/user/devices" });

// 添加用户设备
export const POST = withApiMonitoring(async function POST(request: Request) {
  const originGuard = assertSameOriginOrNoOrigin(request);
  if (originGuard) return originGuard;

  const body = (await request.json()) as {
    deviceId?: string;
  };

  const { deviceId } = body;
  if (!deviceId || !deviceId.trim()) {
    return new Response("设备 ID 不能为空", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  // 确保 user_devices 表存在（兼容旧库）
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

  // 兼容旧数据：删除同一 user_id + device_id 的重复记录（保留 id 最小的一条），然后再创建唯一索引
  await db
    .prepare(
      `DELETE FROM user_devices
       WHERE id NOT IN (
         SELECT MIN(id) FROM user_devices GROUP BY user_id, device_id
       )`
    )
    .run();

  // 为 user_id + device_id 添加唯一索引，防止同一用户重复绑定同一设备
  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_user_device ON user_devices (user_id, device_id)"
    )
    .run();

  const userId = authed.user.id;

  // 校验同一用户是否已经绑定了相同的设备 ID
  const existsQuery = await db
    .prepare(
      "SELECT id FROM user_devices WHERE user_id = ? AND device_id = ? LIMIT 1"
    )
    .bind(userId, deviceId.trim())
    .all<{ id: number }>();

  if (existsQuery.results && existsQuery.results.length > 0) {
    return new Response(
      "该设备 ID 已经绑定在你的账号下。如有疑问，请联系商家说明情况进行换货。",
      { status: 409 }
    );
  }

  // 简单规则：质保期为当前时间起 1 年
  const now = new Date();
  const warrantyExpires = new Date(now);
  warrantyExpires.setFullYear(now.getFullYear() + 1);
  const warrantyExpiresIso = warrantyExpires.toISOString();

  const insert = await db
    .prepare(
      "INSERT INTO user_devices (user_id, device_id, warranty_expires_at) VALUES (?, ?, ?)"
    )
    .bind(userId, deviceId.trim(), warrantyExpiresIso)
    .run();

  const insertedId = insert.meta.last_row_id as number;

  return Response.json({
    id: insertedId,
    deviceId: deviceId.trim(),
    warrantyExpiresAt: warrantyExpiresIso,
  });
}, { name: "POST /api/user/devices" });

// 删除用户设备
export const DELETE = withApiMonitoring(async function DELETE(request: Request) {
  const originGuard = assertSameOriginOrNoOrigin(request);
  if (originGuard) return originGuard;

  const body = (await request.json()) as {
    id?: number;
    deviceId?: string;
  };

  const { id, deviceId } = body;

  if (typeof id !== "number" && (!deviceId || !deviceId.trim())) {
    return new Response("缺少设备标识", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  // 表和索引依然保持兼容处理
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

  const userId = authed.user.id;

  const deleteStmtBase =
    typeof id === "number"
      ? "DELETE FROM user_devices WHERE id = ? AND user_id = ?"
      : "DELETE FROM user_devices WHERE device_id = ? AND user_id = ?";

  const bindValue =
    typeof id === "number" ? id : (deviceId as string).trim();

  const result = await db.prepare(deleteStmtBase).bind(bindValue, userId).run();

  const changes = (result.meta.changes ?? 0) as number;
  if (changes === 0) {
    return new Response("设备不存在或不属于当前用户", { status: 404 });
  }

  return Response.json({ success: true });
}, { name: "DELETE /api/user/devices" });

