export type ScriptShareRow = {
  id: string;
  owner_user_id: number;
  effect_name: string;
  public_username: string;
  lang: string;
  is_public: number;
  r2_key: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
};

export async function ensureScriptSharesTable(db: D1Database) {
  // Keep this aligned with `schema.sql`.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS script_shares (
        id TEXT PRIMARY KEY,
        owner_user_id INTEGER NOT NULL,
        effect_name TEXT NOT NULL,
        public_username TEXT NOT NULL,
        lang TEXT NOT NULL DEFAULT 'zh-CN',
        is_public INTEGER NOT NULL DEFAULT 1,
        r2_key TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_user_id) REFERENCES users(id)
      )`
    )
    .run();

  // Best-effort migrations for existing DBs.
  try {
    await db
      .prepare(
        "ALTER TABLE script_shares ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1"
      )
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column name: is_public")) {
      throw e;
    }
  }

  try {
    await db
      .prepare("ALTER TABLE script_shares ADD COLUMN lang TEXT NOT NULL DEFAULT 'zh-CN'")
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column name: lang")) {
      throw e;
    }
  }

  // Indexes (id is already indexed as PRIMARY KEY)
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_script_shares_owner_created ON script_shares (owner_user_id, created_at DESC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_script_shares_created ON script_shares (created_at DESC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_script_shares_lang_created ON script_shares (lang, created_at DESC)"
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_script_shares_owner_lang_created ON script_shares (owner_user_id, lang, created_at DESC)"
    )
    .run();
}


