import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  ensureFeedbackReplyTable,
  ensureFeedbackTable,
  autoCloseOverdueFeedback,
} from "../../_utils/feedback";
import { assertAdmin } from "../_utils/adminAuth";

type FeedbackRowWithUser = {
  id: number;
  user_email: string;
  type: string | null;
  content: string;
  status: string;
  created_at: string;
  read_at: string | null;
  latest_reply_at: string | null;
  latest_reply_admin_email: string | null;
  latest_reply_content: string | null;
  closed_at: string | null;
};

// 管理端获取用户反馈列表，并返回未读数量
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const adminEmail = searchParams.get("adminEmail");
  const status = searchParams.get("status"); // unread | all

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authError = await assertAdmin(db, adminEmail);
  if (authError) return authError;

  await ensureFeedbackTable(db);
  await ensureFeedbackReplyTable(db);

  // 在管理员查看列表前，自动关闭超时 22 小时的工单
  await autoCloseOverdueFeedback(db);

  const whereParts: string[] = [];
  const bindValues: unknown[] = [];

  // 管理端不显示已关闭的工单
  whereParts.push("f.status != 'closed'");

  if (status === "unread") {
    whereParts.push("f.status = 'unread'");
  }

  const whereSql =
    whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const sql = `SELECT
      f.id,
      u.email AS user_email,
      f.type,
      f.content,
      f.status,
      f.created_at,
      f.read_at,
      f.latest_reply_at,
      a.email AS latest_reply_admin_email,
      (
        SELECT r.content
        FROM user_feedback_replies r
        WHERE r.feedback_id = f.id
          AND (r.sender IS NULL OR r.sender = 'admin')
        ORDER BY r.created_at DESC
        LIMIT 1
      ) AS latest_reply_content,
      f.closed_at
    FROM user_feedback f
    JOIN users u ON f.user_id = u.id
    LEFT JOIN users a ON f.latest_reply_admin_id = a.id
    ${whereSql}
    ORDER BY f.created_at DESC
    LIMIT 50`;

  const { results } = await db
    .prepare(sql)
    .bind(...bindValues)
    .all<FeedbackRowWithUser>();

  const items =
    results?.map((row) => ({
      id: row.id,
      userEmail: row.user_email,
      type: row.type,
      content: row.content,
      status: row.status,
      createdAt: row.created_at,
      readAt: row.read_at,
      latestReplyAt: row.latest_reply_at,
      latestReplyAdminEmail: row.latest_reply_admin_email,
      latestReplyContent: row.latest_reply_content,
      closedAt: row.closed_at,
    })) ?? [];

  const countQuery = await db
    .prepare(
      "SELECT COUNT(*) as unreadCount FROM user_feedback WHERE status = 'unread'"
    )
    .all<{ unreadCount: number }>();

  const unreadCount =
    (countQuery.results?.[0]?.unreadCount as number | undefined) ?? 0;

  return Response.json({ items, unreadCount });
}

// 管理端标记反馈为已读 / 全部已读
export async function POST(request: Request) {
  const body = (await request.json()) as {
    adminEmail?: string;
    action?: "mark-read" | "mark-all-read" | "reply" | "close";
    ids?: number[];
    feedbackId?: number;
    content?: string;
  };

  const adminEmail = body.adminEmail ?? null;
  const action = body.action ?? "mark-read";

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authError = await assertAdmin(db, adminEmail);
  if (authError) return authError;

  await ensureFeedbackTable(db);

  const nowIso = new Date().toISOString();

  if (action === "mark-all-read") {
    await db
      .prepare(
        "UPDATE user_feedback SET status = 'read', read_at = ? WHERE status = 'unread'"
      )
      .bind(nowIso)
      .run();

    return Response.json({ ok: true });
  }

  if (action === "reply") {
    const feedbackId = body.feedbackId;
    const rawContent = body.content ?? "";
    const content = rawContent.trim();

    if (typeof feedbackId !== "number") {
      return new Response("缺少反馈 ID", { status: 400 });
    }
    if (!content) {
      return new Response("回复内容不能为空", { status: 400 });
    }

    await ensureFeedbackReplyTable(db);

    // 如果工单已经关闭，禁止继续回复
    const statusQuery = await db
      .prepare("SELECT status FROM user_feedback WHERE id = ?")
      .bind(feedbackId)
      .all<{ status: string }>();

    const feedbackStatus = statusQuery.results?.[0]?.status;
    if (!feedbackStatus) {
      return new Response("反馈不存在", { status: 404 });
    }
    if (feedbackStatus === "closed") {
      return new Response("工单已关闭，无法继续回复", { status: 400 });
    }

    const adminQuery = await db
      .prepare("SELECT id FROM users WHERE email = ? AND is_admin = 1")
      .bind(adminEmail)
      .all<{ id: number }>();

    const adminRow = adminQuery.results?.[0];
    if (!adminRow) {
      return new Response("管理员不存在", { status: 404 });
    }

    await db
      .prepare(
        "INSERT INTO user_feedback_replies (feedback_id, admin_id, content, created_at) VALUES (?, ?, ?, ?)"
      )
      .bind(feedbackId, adminRow.id, content, nowIso)
      .run();

    await db
      .prepare(
        `UPDATE user_feedback
         SET status = 'read',
             read_at = COALESCE(read_at, ?),
             latest_reply_at = ?,
             latest_reply_admin_id = ?
         WHERE id = ?`
      )
      .bind(nowIso, nowIso, adminRow.id, feedbackId)
      .run();

    return Response.json({ ok: true });
  }

  if (action === "close") {
    const feedbackId = body.feedbackId;

    if (typeof feedbackId !== "number") {
      return new Response("缺少反馈 ID", { status: 400 });
    }

    const statusQuery = await db
      .prepare("SELECT status FROM user_feedback WHERE id = ?")
      .bind(feedbackId)
      .all<{ status: string }>();

    const feedbackStatus = statusQuery.results?.[0]?.status;
    if (!feedbackStatus) {
      return new Response("反馈不存在", { status: 404 });
    }
    if (feedbackStatus === "closed") {
      return Response.json({ ok: true });
    }

    await db
      .prepare(
        `UPDATE user_feedback
         SET status = 'closed',
             closed_at = ?,
             read_at = COALESCE(read_at, ?)
         WHERE id = ?`
      )
      .bind(nowIso, nowIso, feedbackId)
      .run();

    return Response.json({ ok: true });
  }

  const ids = (body.ids ?? []).filter(
    (id): id is number => typeof id === "number"
  );
  if (ids.length === 0) {
    return new Response("缺少需要标记的反馈 ID", { status: 400 });
  }

  const placeholders = ids.map(() => "?").join(", ");

  await db
    .prepare(
      `UPDATE user_feedback
       SET status = 'read',
           read_at = ?
       WHERE id IN (${placeholders})`
    )
    .bind(nowIso, ...ids)
    .run();

  return Response.json({ ok: true });
}


