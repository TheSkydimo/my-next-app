export async function ensureUsersIsAdminColumn(db: D1Database) {
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
  try {
    await db.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column name: avatar_url")) {
      throw e;
    }
  }
}


