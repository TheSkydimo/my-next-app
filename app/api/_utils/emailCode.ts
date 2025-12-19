type EmailCodePurpose =
  | "register"
  | "user-login"
  | "user-forgot"
  | "admin-forgot"
  | "change-email";

export async function ensureEmailCodeTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS email_verification_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        purpose TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run();
}

export async function verifyAndUseEmailCode(options: {
  db: D1Database;
  email: string;
  code: string;
  purpose: EmailCodePurpose;
}): Promise<boolean> {
  const { db, email, code, purpose } = options;

  await ensureEmailCodeTable(db);

  const { results } = await db
    .prepare(
      `SELECT id FROM email_verification_codes
       WHERE email = ? AND code = ? AND purpose = ?
       AND used_at IS NULL AND expires_at > datetime('now')
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .bind(email, code, purpose)
    .all();

  if (!results || results.length === 0) {
    return false;
  }

  const codeId = (results[0] as { id: number }).id;

  await db
    .prepare(
      "UPDATE email_verification_codes SET used_at = datetime('now') WHERE id = ?"
    )
    .bind(codeId)
    .run();

  return true;
}

export type { EmailCodePurpose };


