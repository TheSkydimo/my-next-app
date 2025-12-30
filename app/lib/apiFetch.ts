export async function apiFetch(
  input: RequestInfo | URL,
  init: (RequestInit & {
    appAuth?: {
      /**
       * When true, do not emit the global "app-auth-unauthorized" event on 401/403.
       * Useful for auth probes like GET /api/user/me where 401 is an expected state.
       */
      suppressUnauthorizedEvent?: boolean;
    };
  }) = {}
): Promise<Response> {
  const { appAuth, ...requestInit } = init;
  const res = await fetch(input, {
    ...requestInit,
    // Default to include, so pages don't accidentally drop httpOnly cookie auth.
    credentials: requestInit.credentials ?? "include",
  });

  // 401: not authenticated (expired session / user deleted)
  // 403: authenticated but forbidden (role revoked / access denied)
  // Both should lead to a consistent UX (clear local state + guide to sign in).
  if (
    !appAuth?.suppressUnauthorizedEvent &&
    (res.status === 401 || res.status === 403) &&
    typeof window !== "undefined"
  ) {
    const reason = res.headers.get("X-Auth-Reason") || undefined;
    window.dispatchEvent(
      new CustomEvent("app-auth-unauthorized", {
        detail: { status: res.status, reason },
      })
    );
  }

  return res;
}


