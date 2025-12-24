type ExistingTablesRow = { name: string };

async function getExistingTables(db: D1Database): Promise<Set<string>> {
  const { results } = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all<ExistingTablesRow>();
  return new Set((results ?? []).map((r) => r.name));
}

export async function deleteUserCascade(options: {
  db: D1Database;
  userId: number;
  userEmail: string;
}) {
  const { db, userId, userEmail } = options;

  const tables = await getExistingTables(db);
  const has = (name: string) => tables.has(name);

  // Pre-fetch dependent ids that require ordered deletion.
  const feedbackIds: number[] = [];
  if (has("user_feedback")) {
    const { results } = await db
      .prepare("SELECT id FROM user_feedback WHERE user_id = ?")
      .bind(userId)
      .all<{ id: number }>();
    for (const row of results ?? []) feedbackIds.push(row.id);
  }

  const ownedScriptIds: string[] = [];
  if (has("script_shares")) {
    const { results } = await db
      .prepare("SELECT id FROM script_shares WHERE owner_user_id = ?")
      .bind(userId)
      .all<{ id: string }>();
    for (const row of results ?? []) ownedScriptIds.push(row.id);
  }

  const stmts: D1PreparedStatement[] = [];

  // Email codes are keyed by email, not FK.
  if (has("email_verification_codes")) {
    stmts.push(
      db
        .prepare("DELETE FROM email_verification_codes WHERE email = ?")
        .bind(userEmail)
    );
  }

  // Tables that reference users(id).
  if (has("user_notifications")) {
    stmts.push(
      db.prepare("DELETE FROM user_notifications WHERE user_id = ?").bind(userId)
    );
  }

  if (has("user_orders")) {
    stmts.push(db.prepare("DELETE FROM user_orders WHERE user_id = ?").bind(userId));
  }

  // user_devices currently has no FK, but still clean up to avoid orphans.
  if (has("user_devices")) {
    stmts.push(db.prepare("DELETE FROM user_devices WHERE user_id = ?").bind(userId));
  }

  // Feedback: replies -> feedback (avoid FK constraint on feedback_id).
  if (has("user_feedback_replies") && feedbackIds.length > 0) {
    for (const fid of feedbackIds) {
      stmts.push(
        db.prepare("DELETE FROM user_feedback_replies WHERE feedback_id = ?").bind(fid)
      );
    }
  }
  // If deleting an admin user, also remove replies authored by them (FK admin_id -> users).
  if (has("user_feedback_replies")) {
    stmts.push(
      db.prepare("DELETE FROM user_feedback_replies WHERE admin_id = ?").bind(userId)
    );
  }
  if (has("user_feedback")) {
    stmts.push(db.prepare("DELETE FROM user_feedback WHERE user_id = ?").bind(userId));
  }

  // Script interactions reference users(id) and script_shares(id), so delete them before scripts/users.
  if (has("script_share_likes")) {
    stmts.push(db.prepare("DELETE FROM script_share_likes WHERE user_id = ?").bind(userId));
    for (const sid of ownedScriptIds) {
      stmts.push(
        db.prepare("DELETE FROM script_share_likes WHERE script_id = ?").bind(sid)
      );
    }
  }
  if (has("script_share_favorites")) {
    stmts.push(
      db.prepare("DELETE FROM script_share_favorites WHERE user_id = ?").bind(userId)
    );
    for (const sid of ownedScriptIds) {
      stmts.push(
        db.prepare("DELETE FROM script_share_favorites WHERE script_id = ?").bind(sid)
      );
    }
  }

  if (has("script_shares")) {
    stmts.push(db.prepare("DELETE FROM script_shares WHERE owner_user_id = ?").bind(userId));
  }

  // Finally delete the user.
  stmts.push(db.prepare("DELETE FROM users WHERE id = ?").bind(userId));

  // Execute as a single transaction. If any statement fails, the batch is rolled back.
  await db.batch(stmts);
}


