import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireAdminFromRequest } from "../_utils/adminSession";

export async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return authed;

  return Response.json({ ok: true, admin: authed.admin });
}


