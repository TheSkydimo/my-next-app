import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureUserFeedbackTables } from "../../_utils/userFeedbackTable";
import { ensureUsersTable } from "../../_utils/usersTable";

export async function POST(request: Request) {
  try {
    const { content, email } = (await request.json()) as {
      content: string;
      email?: string;
    };

    if (!content || !content.trim()) {
      return new Response("反馈内容不能为空", { status: 400 });
    }

    if (!email) {
      return new Response("请先登录后再提交反馈", { status: 401 });
    }

    const { env } = await getCloudflareContext();
    const db = env.my_user_db as D1Database;

    await ensureUsersTable(db);
    await ensureUserFeedbackTables(db);

    const { results } = await db
      .prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
      .bind(email)
      .all<{ id: number }>();
    const userId = results?.[0]?.id;
    if (!userId) {
      return new Response("请先登录后再提交反馈", { status: 401 });
    }

    await db
      .prepare(
        `INSERT INTO user_feedback (user_id, type, content, status)
         VALUES (?, 'quick', ?, 'unread')`
      )
      .bind(userId, content.trim())
      .run();

    return Response.json({ ok: true });
  } catch (error) {
    console.error("提交反馈失败:", error);
    return new Response("发送失败，请稍后再试", { status: 500 });
  }
}

