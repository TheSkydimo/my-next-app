import { ensureAdminAuditLogsTable } from "./adminAuditLogsTable";

export type AdminAuditActor = {
  id: number;
  role: "admin" | "super_admin";
};

function getRequestIp(request: Request): string | null {
  // Cloudflare
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf) return cf;
  // Generic proxy headers
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return null;
}

export async function writeAdminAuditLog(options: {
  db: D1Database;
  request: Request;
  actor: AdminAuditActor;
  action: string;
  targetType: "script_share" | "user_notification";
  targetId: string;
  targetOwnerUserId?: number | null;
  reason?: string | null;
  meta?: unknown;
}) {
  const { db, request, actor, action, targetType, targetId } = options;

  // Never block the main flow for audit failures.
  try {
    await ensureAdminAuditLogsTable(db);

    const requestIp = getRequestIp(request);
    const userAgent = request.headers.get("user-agent");
    const urlReason = (() => {
      try {
        return new URL(request.url).searchParams.get("reason");
      } catch {
        return null;
      }
    })();
    const reason =
      options.reason ??
      urlReason ??
      request.headers.get("x-admin-reason") ??
      request.headers.get("X-Admin-Reason") ??
      null;

    // Avoid storing unbounded user-provided strings (log/DB abuse hardening).
    const safeReason =
      typeof reason === "string"
        ? (reason.trim().length > 200 ? reason.trim().slice(0, 200) : reason.trim())
        : null;

    const metaJson =
      options.meta == null
        ? null
        : (() => {
            try {
              return JSON.stringify(options.meta);
            } catch {
              return JSON.stringify({ meta: "unserializable" });
            }
          })();

    await db
      .prepare(
        `INSERT INTO admin_audit_logs
         (actor_admin_id, actor_role, action, target_type, target_id, target_owner_user_id, request_ip, user_agent, reason, meta_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        actor.id,
        actor.role,
        action,
        targetType,
        targetId,
        options.targetOwnerUserId ?? null,
        requestIp,
        userAgent,
        safeReason,
        metaJson
      )
      .run();
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    // Security: avoid leaking internal stacks/paths in production logs.
    console.error(
      "writeAdminAuditLog failed:",
      JSON.stringify(
        {
          name: err.name,
          message: err.message,
          stack:
            process.env.NODE_ENV === "development"
              ? err.stack?.slice(0, 2000)
              : undefined,
        },
        null,
        0
      )
    );
  }
}


