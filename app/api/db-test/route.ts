import { getCloudflareContext } from "@opennextjs/cloudflare";

// app/api/db-test/route.ts

export async function GET() {
  return new Response("hello from api");
}

