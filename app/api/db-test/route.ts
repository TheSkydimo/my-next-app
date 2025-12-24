// app/api/db-test/route.ts

import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";

export const GET = withApiMonitoring(async function GET(request: Request) {
  void request;
  return new Response("hello from api");
}, { name: "GET /api/db-test" });

