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
  const selectVipExpiresAt = cols.has("vip_expires_at") ? "vip_expires_at" : "NULL";
  const selectCreatedAt = cols.has("created_at") ? "created_at" : "CURRENT_TIMESTAMP";

  // Best-effort migration with FK temporarily disabled (SQLite requirement when rebuilding tables).
  await db.prepare("PRAGMA foreign_keys=off").run();
  await db.prepare("BEGIN").run();
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS users__new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          avatar_url TEXT,
          is_admin INTEGER NOT NULL DEFAULT 0,
          is_super_admin INTEGER NOT NULL DEFAULT 0,
          vip_expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      )
      .run();

    await db
      .prepare(
        `INSERT INTO users__new (id, username, email, avatar_url, is_admin, is_super_admin, vip_expires_at, created_at)
         SELECT id, username, email, ${selectAvatarUrl}, ${selectIsAdmin}, ${selectIsSuperAdmin}, ${selectVipExpiresAt}, ${selectCreatedAt}
         FROM users`
      )
      .run();

    await db.prepare("DROP TABLE users").run();
    await db.prepare("ALTER TABLE users__new RENAME TO users").run();

    await db.prepare("COMMIT").run();
  } catch (e) {
    try {
      await db.prepare("ROLLBACK").run();
    } catch {
      // ignore
    }
    throw e;
  } finally {
    await db.prepare("PRAGMA foreign_keys=on").run();
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


