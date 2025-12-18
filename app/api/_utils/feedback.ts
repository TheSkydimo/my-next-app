type FeedbackStatus = "unread" | "read" | "closed";

export type FeedbackRow = {
  id: number;
  user_id: number;
  type: string | null;
  content: string;
  status: FeedbackStatus;
  created_at: string;
  read_at: string | null;
  latest_reply_at: string | null;
  latest_reply_admin_id: number | null;
  closed_at: string | null;
};

export async function ensureFeedbackTable(db: D1Database) {
  // 初次创建表（兼容旧库：如果表已存在则不会重复创建）
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'unread',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP,
        latest_reply_at TIMESTAMP,
        latest_reply_admin_id INTEGER,
        closed_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    )
    .run();

  // 常用索引（用户 & 状态），提高查询和未读统计性能
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_user_feedback_user ON user_feedback (user_id, created_at DESC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON user_feedback (status, created_at DESC)"
    )
    .run();

  // 兼容旧结构：如果历史表缺少字段，则尝试补齐（字段已存在时忽略报错）
  try {
    await db
      .prepare(
        "ALTER TABLE user_feedback ADD COLUMN status TEXT NOT NULL DEFAULT 'unread'"
      )
      .run();
  } catch {
    // ignore
  }
  try {
    await db
      .prepare("ALTER TABLE user_feedback ADD COLUMN read_at TIMESTAMP")
      .run();
  } catch {
    // ignore
  }
  try {
    await db
      .prepare("ALTER TABLE user_feedback ADD COLUMN latest_reply_at TIMESTAMP")
      .run();
  } catch {
    // ignore
  }
  try {
    await db
      .prepare(
        "ALTER TABLE user_feedback ADD COLUMN latest_reply_admin_id INTEGER"
      )
      .run();
  } catch {
    // ignore
  }
  try {
    await db
      .prepare("ALTER TABLE user_feedback ADD COLUMN closed_at TIMESTAMP")
      .run();
  } catch {
    // ignore
  }
  try {
    await db
      .prepare("ALTER TABLE user_feedback ADD COLUMN type TEXT")
      .run();
  } catch {
    // ignore
  }
}

export async function ensureFeedbackReplyTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_feedback_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feedback_id INTEGER NOT NULL,
        admin_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (feedback_id) REFERENCES user_feedback(id),
        FOREIGN KEY (admin_id) REFERENCES users(id)
      )`
    )
    .run();

  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_feedback_replies_feedback ON user_feedback_replies (feedback_id, created_at DESC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_feedback_replies_admin ON user_feedback_replies (admin_id, created_at DESC)"
    )
    .run();

  // 兼容旧结构：为回复表增加 sender 字段，用于区分管理员 / 用户消息
  try {
    await db
      .prepare(
        "ALTER TABLE user_feedback_replies ADD COLUMN sender TEXT"
      )
      .run();
  } catch {
    // ignore
  }
}

// 自动关闭超时未再次处理的工单：
// 规则：距离最近一次管理员回复时间（如无回复则使用创建时间）超过 22 小时，且状态不是 closed，则标记为 closed
export async function autoCloseOverdueFeedback(db: D1Database) {
  await db
    .prepare(
      `UPDATE user_feedback
       SET status = 'closed',
           closed_at = CURRENT_TIMESTAMP
       WHERE status != 'closed'
         AND COALESCE(latest_reply_at, created_at) <= datetime('now', '-22 hours')`
    )
    .run();
}

export type { FeedbackStatus };

