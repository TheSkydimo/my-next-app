type EmailCodePurpose =
  | "register"
  | "user-login"
  | "admin-login"
  | "change-email";

export async function ensureEmailCodeTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS email_verification_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        challenge_id TEXT NOT NULL,
        code TEXT NOT NULL,
        purpose TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        invalidated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run();

  // Best-effort migrations (no backward-compat required, but keep existing DBs working)
  // Add challenge_id
  try {
    await db
      .prepare("ALTER TABLE email_verification_codes ADD COLUMN challenge_id TEXT")
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column name: challenge_id")) {
      // ignore other errors to avoid blocking; table may already be in new schema
    }
  }

  // Add invalidated_at
  try {
    await db
      .prepare("ALTER TABLE email_verification_codes ADD COLUMN invalidated_at TIMESTAMP")
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column name: invalidated_at")) {
      // ignore
    }
  }

  // Optional indices (best-effort)
  try {
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_email_codes_lookup ON email_verification_codes (email, purpose, challenge_id)"
      )
      .run();
  } catch {
    // ignore
  }
  try {
    await db
      .prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_email_codes_challenge_unique ON email_verification_codes (challenge_id)"
      )
      .run();
  } catch {
    // ignore
  }
  try {
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_email_codes_cleanup ON email_verification_codes (expires_at, used_at, invalidated_at)"
      )
      .run();
  } catch {
    // ignore
  }
}

export async function verifyAndUseEmailCode(options: {
  db: D1Database;
  email: string;
  code: string;
  purpose: EmailCodePurpose;
  challengeId: string;
}): Promise<boolean> {
  const { db, email, code, purpose, challengeId } = options;

  await ensureEmailCodeTable(db);

  // Atomic consume: succeeds only once and immediately invalidates for reuse.
  const result = await db
    .prepare(
      `UPDATE email_verification_codes
       SET used_at = datetime('now')
       WHERE email = ? AND purpose = ? AND challenge_id = ? AND code = ?
         AND used_at IS NULL
         AND (invalidated_at IS NULL)
         AND expires_at > datetime('now')`
    )
    .bind(email, purpose, challengeId, code)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

export type { EmailCodePurpose };


