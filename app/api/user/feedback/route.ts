import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  ensureFeedbackReplyTable,
  ensureFeedbackTable,
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
  };

  const email = body.email?.trim();
  const rawContent = body.content?.trim();

  if (!email) {
    return new Response("邮箱不能为空", { status: 400 });
  }
  if (!rawContent) {
    return new Response("反馈内容不能为空", { status: 400 });
  }

  // 不再在内容前自动拼接 "[path]" 标签，避免在用户历史记录中出现多余的方括号前缀
  const content = rawContent;

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

  const insert = await db
    .prepare(
      "INSERT INTO user_feedback (user_id, content, status) VALUES (?, ?, 'unread')"
    )
    .bind(user.id, content)
    .run();

  const insertedId = insert.meta.last_row_id as number;

  return Response.json({
    id: insertedId,
    createdAt: new Date().toISOString(),
  });
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

  const { results } = await db
    .prepare(
      `SELECT
         f.id,
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
         ) AS latest_reply_content
       FROM user_feedback f
       LEFT JOIN users a ON f.latest_reply_admin_id = a.id
       WHERE f.user_id = ?
       ORDER BY f.created_at ASC
       LIMIT 50`
    )
    .bind(user.id)
    .all<{
      id: number;
      content: string;
      status: string;
      created_at: string;
      read_at: string | null;
      latest_reply_at: string | null;
      latest_reply_admin_email: string | null;
      latest_reply_content: string | null;
    }>();

  const items =
    results?.map((row) => ({
      id: row.id,
      content: row.content,
      status: row.status,
      createdAt: row.created_at,
      readAt: row.read_at,
      latestReplyAt: row.latest_reply_at,
      latestReplyAdminEmail: row.latest_reply_admin_email,
      latestReplyContent: row.latest_reply_content,
    })) ?? [];

  return Response.json({ items });
}


