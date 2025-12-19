export async function ensureUsersTable(db: D1Database) {
  // Keep this aligned with `schema.sql`.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        avatar_url TEXT,
        password_hash TEXT NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0,
        is_super_admin INTEGER NOT NULL DEFAULT 0,
        vip_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run();
}

export async function ensureUsersIsAdminColumn(db: D1Database) {
  await ensureUsersTable(db);
  try {
    await db
      .prepare("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column name: is_admin")) {
      throw e;
    }
  }
}

export async function ensureUsersAvatarUrlColumn(db: D1Database) {
  await ensureUsersTable(db);
  try {
    await db.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column name: avatar_url")) {
      throw e;
    }
  }
}


