export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    // Default to include, so pages don't accidentally drop httpOnly cookie auth.
    credentials: init.credentials ?? "include",
  });

  if (res.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app-auth-unauthorized"));
  }

  return res;
}


