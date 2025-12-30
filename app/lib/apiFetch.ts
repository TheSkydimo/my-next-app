export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    // Default to include, so pages don't accidentally drop httpOnly cookie auth.
    credentials: init.credentials ?? "include",
  });

  // 401: not authenticated (expired session / user deleted)
  // 403: authenticated but forbidden (role revoked / access denied)
  // Both should lead to a consistent UX (clear local state + guide to sign in).
  if ((res.status === 401 || res.status === 403) && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("app-auth-unauthorized", { detail: { status: res.status } })
    );
  }

  return res;
}


