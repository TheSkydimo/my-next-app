// app/api/db-test/route.ts

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getRuntimeEnvVar } from "../_utils/runtimeEnv";
import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

export const GET = withApiMonitoring(async function GET(request: Request) {
  void request;

  // Security: reduce attack surface; keep this endpoint dev-only.
  const { env } = await getCloudflareContext();
  const isDev =
    process.env.NODE_ENV === "development" ||
    getRuntimeEnvVar(env, "NEXTJS_ENV") === "development";
  if (!isDev) return new Response("Not found", { status: 404 });

  return new Response("hello from api");
}, { name: "GET /api/db-test" });

