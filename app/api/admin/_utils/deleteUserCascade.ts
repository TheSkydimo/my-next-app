type ExistingTablesRow = { name: string };

import { r2KeyFromSchemeUrl } from "../../_utils/r2ObjectUrls";

async function getExistingTables(db: D1Database): Promise<Set<string>> {
  const { results } = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all<ExistingTablesRow>();
  return new Set((results ?? []).map((r) => r.name));
}

function uniqueNonEmptyStrings(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

async function deleteR2KeysStrict(options: {
  r2: R2Bucket;
  keys: string[];
  label: string;
}) {
  const { r2, keys, label } = options;
  if (keys.length === 0) return;

  // R2Bucket.delete supports string or string[]. Use chunking to avoid huge payloads.
  const chunkSize = 200;
  const failed: string[] = [];

  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += chunkSize) {
    chunks.push(keys.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    try {
      await r2.delete(chunk);
    } catch {
      // Fallback: try per-key to avoid failing the whole cascade due to one key.
      for (const key of chunk) {
        try {
          await r2.delete(key);
        } catch {
          failed.push(key);
        }
      }
    }
  }

  if (failed.length > 0) {
    // Do not leak keys in error messages/logs.
    throw new Error(`R2_DELETE_FAILED:${label}:${failed.length}`);
  }
}

async function deleteR2PrefixStrict(options: {
  r2: R2Bucket;
  prefix: string;
  label: string;
}) {
  const { r2, prefix, label } = options;
  let cursor: string | undefined = undefined;
  const toDelete: string[] = [];

  // Collect first to avoid partial deletion if listing fails mid-way.
  // (If list fails, we prefer to abort and not delete DB user.)
  while (true) {
    const res = await r2.list({ prefix, cursor });
    for (const obj of res.objects ?? []) {
      if (obj?.key) toDelete.push(obj.key);
    }
    if (!res.truncated) break;
    cursor = res.cursor;
    if (!cursor) break;
  }

  const unique = uniqueNonEmptyStrings(toDelete);
  await deleteR2KeysStrict({ r2, keys: unique, label });
}

export async function deleteUserCascade(options: {
  db: D1Database;
  userId: number;
  userEmail: string;
  r2?: R2Bucket;
}) {
  const { db, userId, userEmail, r2 } = options;

  const tables = await getExistingTables(db);
  const has = (name: string) => tables.has(name);

  // Pre-delete user-owned R2 objects (strict): if any R2 deletion fails, abort user deletion.
  if (r2) {
    const orderImageKeys: string[] = [];
    if (has("user_orders")) {
      const { results } = await db
        .prepare("SELECT image_url FROM user_orders WHERE user_id = ?")
        .bind(userId)
        .all<{ image_url: string }>();
      for (const row of results ?? []) {
        const key = r2KeyFromSchemeUrl(String(row.image_url ?? ""));
        if (key) orderImageKeys.push(key);
      }
    }

    const scriptKeys: string[] = [];
    if (has("script_shares")) {
      const { results } = await db
        .prepare("SELECT r2_key, cover_r2_key FROM script_shares WHERE owner_user_id = ?")
        .bind(userId)
        .all<{ r2_key: string; cover_r2_key: string | null }>();
      for (const row of results ?? []) {
        if (row?.r2_key) scriptKeys.push(row.r2_key);
        if (row?.cover_r2_key) scriptKeys.push(row.cover_r2_key);
      }
    }

    // Delete known keys first, then purge avatar prefix (handles historical avatar leftovers).
    const uniqueKeys = uniqueNonEmptyStrings([...orderImageKeys, ...scriptKeys]);
    await deleteR2KeysStrict({ r2, keys: uniqueKeys, label: "known-user-assets" });
    await deleteR2PrefixStrict({
      r2,
      prefix: `avatars/${userId}/`,
      label: "avatar-prefix",
    });
  }

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


