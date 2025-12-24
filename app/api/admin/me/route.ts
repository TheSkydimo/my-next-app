import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireAdminFromRequest } from "../_utils/adminSession";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

export const GET = withApiMonitoring(async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  return Response.json({ ok: true, admin: authed.admin });
}, { name: "GET /api/admin/me" });


