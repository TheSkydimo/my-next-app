export type ScriptShareLikeRow = {
  script_id: string;
  user_id: number;
  created_at: string;
};

export type ScriptShareFavoriteRow = {
  script_id: string;
  user_id: number;
  created_at: string;
};

export async function ensureScriptShareLikesTable(db: D1Database) {
  // Keep this aligned with `schema.sql`.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS script_share_likes (
        script_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (script_id, user_id),
        FOREIGN KEY (script_id) REFERENCES script_shares(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    )
    .run();

  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_script_share_likes_script ON script_share_likes (script_id, created_at DESC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_script_share_likes_user ON script_share_likes (user_id, created_at DESC)"
    )
    .run();
}

export async function ensureScriptShareFavoritesTable(db: D1Database) {
  // Keep this aligned with `schema.sql`.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS script_share_favorites (
        script_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (script_id, user_id),
        FOREIGN KEY (script_id) REFERENCES script_shares(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    )
    .run();

  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_script_share_favorites_script ON script_share_favorites (script_id, created_at DESC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_script_share_favorites_user ON script_share_favorites (user_id, created_at DESC)"
    )
    .run();
}

export async function ensureScriptShareInteractionsTables(db: D1Database) {
  await ensureScriptShareLikesTable(db);
  await ensureScriptShareFavoritesTable(db);
}

export async function deleteScriptShareInteractions(options: {
  db: D1Database;
  scriptId: string;
}) {
  const { db, scriptId } = options;
  // Order does not matter, but keep it explicit.
  await db.prepare("DELETE FROM script_share_likes WHERE script_id = ?").bind(scriptId).run();
  await db
    .prepare("DELETE FROM script_share_favorites WHERE script_id = ?")
    .bind(scriptId)
    .run();
}

export async function getScriptShareInteractionStats(options: {
  db: D1Database;
  scriptId: string;
  userId: number;
}): Promise<{
  likeCount: number;
  favoriteCount: number;
  likedByMe: boolean;
  favoritedByMe: boolean;
  likeCanUndo: boolean;
  likeLocked: boolean;
}> {
  const { db, scriptId, userId } = options;

  const { results } = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM script_share_likes WHERE script_id = ?) AS like_count,
         (SELECT COUNT(*) FROM script_share_favorites WHERE script_id = ?) AS favorite_count,
         EXISTS(SELECT 1 FROM script_share_likes WHERE script_id = ? AND user_id = ?) AS liked_by_me,
         EXISTS(SELECT 1 FROM script_share_favorites WHERE script_id = ? AND user_id = ?) AS favorited_by_me,
         (
           SELECT CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END
           FROM script_share_likes
           WHERE script_id = ? AND user_id = ?
           LIMIT 1
         ) AS my_like_can_undo`
    )
    .bind(scriptId, scriptId, scriptId, userId, scriptId, userId, scriptId, userId)
    .all<{
      like_count: number;
      favorite_count: number;
      liked_by_me: number;
      favorited_by_me: number;
      my_like_can_undo: number | null;
    }>();

  const row = results?.[0];
  const likeCount = row?.like_count ?? 0;
  const favoriteCount = row?.favorite_count ?? 0;
  const likedByMe = !!row?.liked_by_me;
  const favoritedByMe = !!row?.favorited_by_me;
  const likeCanUndo = row?.my_like_can_undo === 1;

  return {
    likeCount,
    favoriteCount,
    likedByMe,
    favoritedByMe,
    likeCanUndo,
    likeLocked: likedByMe && !likeCanUndo,
  };
}


