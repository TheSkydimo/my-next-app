type TableInfoRow = {
  name: string;
};

async function getUsersTableColumns(db: D1Database): Promise<Set<string>> {
  const { results } = await db.prepare("PRAGMA table_info(users)").all<TableInfoRow>();
  return new Set((results ?? []).map((r) => r.name));
}

async function maybeMigrateUsersTableRemoveLegacyAuthColumn(db: D1Database) {
  const cols = await getUsersTableColumns(db);
  if (!cols.has("password_hash")) return;

  // Drop legacy auth column `password_hash`.
  // This is a destructive schema change (allowed in this repo).
  const selectAvatarUrl = cols.has("avatar_url") ? "avatar_url" : "NULL";
  const selectIsAdmin = cols.has("is_admin") ? "is_admin" : "0";
  const selectIsSuperAdmin = cols.has("is_super_admin") ? "is_super_admin" : "0";
  const selectSessionJti = cols.has("session_jti") ? "session_jti" : "NULL";
  const selectVipExpiresAt = cols.has("vip_expires_at") ? "vip_expires_at" : "NULL";
  const selectCreatedAt = cols.has("created_at") ? "created_at" : "CURRENT_TIMESTAMP";

  // Prefer SQLite DROP COLUMN if supported (avoids rebuilding the table).
  try {
    await db.prepare("ALTER TABLE users DROP COLUMN password_hash").run();
    return;
  } catch {
    // fall back to table rebuild
  }

  // Fallback migration: rebuild users table without legacy column.
  // Note: Avoid explicit BEGIN/COMMIT here; D1 may not support manual transactions in all contexts.
  try {
    await db.prepare("PRAGMA foreign_keys=off").run();
  } catch {
    // ignore (best-effort)
  }

  try {
    await db.batch([
      db.prepare(
        `CREATE TABLE IF NOT EXISTS users__new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          avatar_url TEXT,
          is_admin INTEGER NOT NULL DEFAULT 0,
          is_super_admin INTEGER NOT NULL DEFAULT 0,
          session_jti TEXT,
          vip_expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      ),
      db.prepare(
        `INSERT INTO users__new (id, username, email, avatar_url, is_admin, is_super_admin, session_jti, vip_expires_at, created_at)
         SELECT id, username, email, ${selectAvatarUrl}, ${selectIsAdmin}, ${selectIsSuperAdmin}, ${selectSessionJti}, ${selectVipExpiresAt}, ${selectCreatedAt}
         FROM users`
      ),
      db.prepare("DROP TABLE users"),
      db.prepare("ALTER TABLE users__new RENAME TO users"),
    ]);
  } finally {
    try {
      await db.prepare("PRAGMA foreign_keys=on").run();
    } catch {
      // ignore (best-effort)
    }
  }
}

export async function ensureUsersTable(db: D1Database) {
  // Keep this aligned with `schema.sql`.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        avatar_url TEXT,
        is_admin INTEGER NOT NULL DEFAULT 0,
        is_super_admin INTEGER NOT NULL DEFAULT 0,
        session_jti TEXT,
        vip_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run();

  // If the table exists with legacy auth columns, rebuild it to the new schema.
  await maybeMigrateUsersTableRemoveLegacyAuthColumn(db);
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

export async function ensureUsersIsSuperAdminColumn(db: D1Database) {
  await ensureUsersTable(db);
  try {
    await db
      .prepare(
        "ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0"
      )
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column name: is_super_admin")) {
      throw e;
    }
  }
}

export async function ensureUsersSessionJtiColumn(db: D1Database) {
  await ensureUsersTable(db);
  try {
    await db.prepare("ALTER TABLE users ADD COLUMN session_jti TEXT").run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column name: session_jti")) {
      throw e;
    }
  }
}


