import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  ensureFeedbackReplyTable,
  ensureFeedbackTable,
} from "../../../_utils/feedback";

type UserRow = {
  id: number;
  email: string;
};

type MessageRow = {
  id: number;
  content: string;
  created_at: string;
  sender: string | null;
};

// 获取单个工单的完整对话（用户首条 + 后续管理员 / 用户消息）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const feedbackIdParam = searchParams.get("feedbackId");

  if (!email) {
    return new Response("缺少 email 参数", { status: 400 });
  }
  const feedbackId = Number(feedbackIdParam);
  if (!feedbackId || Number.isNaN(feedbackId)) {
    return new Response("缺少或非法的 feedbackId 参数", { status: 400 });
  }

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

  const feedbackQuery = await db
    .prepare(
      "SELECT id, user_id, content, created_at FROM user_feedback WHERE id = ? AND user_id = ?"
    )
    .bind(feedbackId, user.id)
    .all<{
      id: number;
      user_id: number;
      content: string;
      created_at: string;
    }>();

  const feedback = feedbackQuery.results?.[0];
  if (!feedback) {
    return new Response("工单不存在", { status: 404 });
  }

  const replies = await db
    .prepare(
      "SELECT id, content, created_at, sender FROM user_feedback_replies WHERE feedback_id = ? ORDER BY created_at ASC"
    )
    .bind(feedback.id)
    .all<MessageRow>();

  const items = [
    {
      id: `ticket-${feedback.id}`,
      sender: "user" as const,
      content: feedback.content,
      createdAt: feedback.created_at,
    },
    ...(replies.results ?? []).map((row) => ({
      id: row.id,
      sender: row.sender === "user" ? ("user" as const) : ("admin" as const),
      content: row.content,
      createdAt: row.created_at,
    })),
  ];

  return Response.json({ items });
}

// 用户在已有工单下追加回复
export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    feedbackId?: number;
    content?: string;
  };

  const email = body.email?.trim();
  const rawContent = body.content?.trim() ?? "";
  const feedbackId = body.feedbackId;

  if (!email) {
    return new Response("邮箱不能为空", { status: 400 });
  }
  if (typeof feedbackId !== "number" || Number.isNaN(feedbackId)) {
    return new Response("缺少反馈 ID", { status: 400 });
  }
  if (!rawContent) {
    return new Response("回复内容不能为空", { status: 400 });
  }

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

  const feedbackQuery = await db
    .prepare("SELECT id, user_id, status FROM user_feedback WHERE id = ?")
    .bind(feedbackId)
    .all<{ id: number; user_id: number; status: string }>();

  const feedback = feedbackQuery.results?.[0];
  if (!feedback || feedback.user_id !== user.id) {
    return new Response("工单不存在", { status: 404 });
  }
  if (feedback.status === "closed") {
    return new Response("工单已关闭，无法继续回复", { status: 400 });
  }

  const nowIso = new Date().toISOString();

  await db
    .prepare(
      "INSERT INTO user_feedback_replies (feedback_id, admin_id, content, created_at, sender) VALUES (?, ?, ?, ?, 'user')"
    )
    .bind(feedbackId, user.id, rawContent, nowIso)
    .run();

  // 用户追加消息后，将工单重新标记为未读，提醒管理员查看
  await db
    .prepare(
      "UPDATE user_feedback SET status = 'unread', read_at = NULL WHERE id = ? AND status != 'closed'"
    )
    .bind(feedbackId)
    .run();

  return Response.json({ ok: true, createdAt: nowIso });
}


