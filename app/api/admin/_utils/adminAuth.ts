/**
 * Shared admin auth helpers for admin API routes.
 * Keep this file small and dependency-free to avoid coupling.
 */

export async function assertAdmin(
  db: D1Database,
  adminEmail: string | null
): Promise<Response | null> {
  if (!adminEmail) {
    return new Response("缺少管理员邮箱", { status: 401 });
  }

  const { results } = await db
    .prepare("SELECT id FROM users WHERE email = ? AND is_admin = 1")
    .bind(adminEmail)
    .all();

  if (!results || results.length === 0) {
    return new Response("无权访问：不是管理员账号", { status: 403 });
  }

  return null;
}

export async function isSuperAdmin(
  db: D1Database,
  adminEmail: string
): Promise<boolean> {
  const { results } = await db
    .prepare(
      "SELECT is_super_admin FROM users WHERE email = ? AND is_admin = 1"
    )
    .bind(adminEmail)
    .all<{ is_super_admin: number }>();

  const row = results?.[0];
  return !!row?.is_super_admin;
}


