import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireUserFromRequest } from "../_utils/userSession";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

export const GET = withApiMonitoring(async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireUserFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  return Response.json(authed.user, { headers: { "Cache-Control": "no-store" } });
}, { name: "GET /api/user/me" });


