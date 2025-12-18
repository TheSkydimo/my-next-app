import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  ensureFeedbackReplyTable,
  ensureFeedbackTable,
  autoCloseOverdueFeedback,
} from "../../_utils/feedback";

type UserRow = {
  id: number;
  email: string;
};

// 普通用户提交反馈
export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    content?: string;
    pagePath?: string | null;
    type?: string;
  };

  const email = body.email?.trim();
  const rawContent = body.content?.trim();
  const rawType = body.type?.trim() || "other";

  if (!email) {
    return new Response("邮箱不能为空", { status: 400 });
  }
  if (!rawContent) {
    return new Response("反馈内容不能为空", { status: 400 });
  }

  // 不再在内容前自动拼接 "[path]" 标签，避免在用户历史记录中出现多余的方括号前缀
  const content = rawContent;

  // 反馈类型（简单做一个白名单防御，避免脏数据）
  const allowedTypes = ["bug", "feature", "billing", "other"];
  const type = allowedTypes.includes(rawType) ? rawType : "other";

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  await ensureFeedbackTable(db);
  await ensureFeedbackReplyTable(db);

  const userQuery = await db
    .prepare("SELECT id, email FROM users WHERE email = ?")
    .bind(email)
    .all<UserRow>();

  const user = userQuery.results?.[0];
  if (!user) {
    return new Response("用户不存在", { status: 404 });
  }

  // 限制：同一时间用户只能有一个未关闭的工单
  const existingOpen = await db
    .prepare(
      "SELECT id FROM user_feedback WHERE user_id = ? AND status != 'closed' ORDER BY created_at DESC LIMIT 1"
    )
    .bind(user.id)
    .all<{ id: number }>();

  if (existingOpen.results && existingOpen.results.length > 0) {
    return new Response(
      "你已有一个正在处理中的工单，请等待处理结果或在该工单中查看回复。",
      { status: 400 }
    );
  }

  const insert = await db
    .prepare(
      "INSERT INTO user_feedback (user_id, type, content, status) VALUES (?, ?, ?, 'unread')"
    )
    .bind(user.id, type, content)
    .run();

  const insertedId = insert.meta.last_row_id as number;

  return Response.json({
    id: insertedId,
    createdAt: new Date().toISOString(),
  });
}

// 用户删除自己的已关闭历史工单
export async function DELETE(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    feedbackId?: number;
  };

  const email = body.email?.trim();
  const feedbackId = body.feedbackId;

  if (!email) {
    return new Response("缺少 email 参数", { status: 400 });
  }
  if (typeof feedbackId !== "number") {
    return new Response("缺少工单 ID", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  await ensureFeedbackTable(db);
  await ensureFeedbackReplyTable(db);

  // 验证用户存在
  const userQuery = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .all<{ id: number }>();

  const user = userQuery.results?.[0];
  if (!user) {
    return new Response("用户不存在", { status: 404 });
  }

  // 验证工单存在且属于该用户
  const feedbackQuery = await db
    .prepare("SELECT id, user_id, status FROM user_feedback WHERE id = ?")
    .bind(feedbackId)
    .all<{ id: number; user_id: number; status: string }>();

  const feedback = feedbackQuery.results?.[0];
  if (!feedback) {
    return new Response("工单不存在", { status: 404 });
  }
  if (feedback.user_id !== user.id) {
    return new Response("无权删除他人工单", { status: 403 });
  }

  // 只允许删除已关闭的工单
  if (feedback.status !== "closed") {
    return new Response("只能删除已关闭的工单", { status: 400 });
  }

  // 先删除相关的回复记录
  await db
    .prepare("DELETE FROM user_feedback_replies WHERE feedback_id = ?")
    .bind(feedbackId)
    .run();

  // 删除工单
  await db
    .prepare("DELETE FROM user_feedback WHERE id = ?")
    .bind(feedbackId)
    .run();

  return Response.json({ ok: true });
}

// 当前用户查看自己历史反馈（按时间顺序，最多返回最近 50 条）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return new Response("缺少 email 参数", { status: 400 });
  }

  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  await ensureFeedbackTable(db);

  const userQuery = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .all<{ id: number }>();

  const user = userQuery.results?.[0];
  if (!user) {
    return new Response("用户不存在", { status: 404 });
  }

  // 在返回用户工单前，先自动关闭超时 22 小时的工单
  await autoCloseOverdueFeedback(db);

  const { results } = await db
    .prepare(
      `SELECT
         f.id,
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
           ORDER BY r.created_at DESC
           LIMIT 1
         ) AS latest_reply_content,
         f.closed_at
       FROM user_feedback f
       LEFT JOIN users a ON f.latest_reply_admin_id = a.id
       WHERE f.user_id = ?
       ORDER BY f.created_at ASC
       LIMIT 50`
    )
    .bind(user.id)
    .all<{
      id: number;
      type: string | null;
      content: string;
      status: string;
      created_at: string;
      read_at: string | null;
      latest_reply_at: string | null;
      latest_reply_admin_email: string | null;
      latest_reply_content: string | null;
      closed_at: string | null;
    }>();

  const items =
    results?.map((row) => ({
      id: row.id,
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

  return Response.json({ items });
}


