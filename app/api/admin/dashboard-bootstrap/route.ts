import { withApiMonitoring } from "@/server/monitoring/withApiMonitoring";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireAdminFromRequest } from "../_utils/adminSession";

function withNoStore(res: Response) {
  const next = new Response(res.body, res);
  next.headers.set("Cache-Control", "no-store");
  return next;
}

type BootstrapResult = {
  ok: true;
  admin: unknown;
  /**
   * 精准 seed：key 为前端 fetch 的 URL（保持完全一致），value 为对应接口 JSON
   * 这样可以做到“无损”：页面逻辑不变，只是优先命中缓存。
   */
  cacheSeed: Record<string, unknown>;
};

async function fetchJsonBestEffort(
  request: Request,
  url: string
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    const res = await fetch(new URL(url, request.url), {
      method: "GET",
      // Forward cookies for auth; never log them.
      headers: {
        cookie: request.headers.get("cookie") ?? "",
        "accept-language": request.headers.get("accept-language") ?? "",
      },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    const data = await res.json().catch(() => null);
    if (data === null) return { ok: false };
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

/**
 * 管理端 Dashboard 一次性预加载接口（只新增，不改现有接口）
 * - 基于 httpOnly session cookie + 管理员权限鉴权（requireAdminFromRequest）
 * - Cache-Control: no-store（避免被边缘缓存）
 * - best-effort：任一子请求失败不阻断登录，只是不 seed 该项
 */
export const GET = withApiMonitoring(async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const db = env.my_user_db as D1Database;

  const authed = await requireAdminFromRequest({ request, env, db });
  if (authed instanceof Response) return withNoStore(authed);

  // Seed keys MUST match page code exactly (including trailing '?' if present).
  const usersRoleUser = (() => {
    const params = new URLSearchParams({
      role: "user",
      page: "1",
      pageSize: "15",
    });
    return `/api/admin/users?${params.toString()}`;
  })();

  const usersRoleAdmin = (() => {
    const params = new URLSearchParams({
      role: "admin",
      page: "1",
      pageSize: "15",
    });
    return `/api/admin/users?${params.toString()}`;
  })();

  // Admin orders page uses `/api/admin/orders?${params.toString()}` with empty params => trailing '?'
  const ordersListKey = "/api/admin/orders?";

  // Script shares page defaults: page=1 pageSize=50 lang=all
  const scriptSharesKey = (() => {
    const params = new URLSearchParams({ page: "1", pageSize: "50", lang: "all" });
    return `/api/admin/script-shares?${params.toString()}`;
  })();

  const targets = [usersRoleUser, usersRoleAdmin, ordersListKey, scriptSharesKey] as const;

  const results = await Promise.all(
    targets.map(async (key) => ({ key, res: await fetchJsonBestEffort(request, key) }))
  );

  const cacheSeed: Record<string, unknown> = {};
  for (const r of results) {
    if (r.res.ok) cacheSeed[r.key] = r.res.data;
  }

  const payload: BootstrapResult = {
    ok: true,
    admin: authed.admin,
    cacheSeed,
  };

  return withNoStore(Response.json(payload));
}, { name: "GET /api/admin/dashboard-bootstrap" });


