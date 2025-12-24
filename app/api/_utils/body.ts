export async function readJsonBody<T>(request: Request): Promise<
  | { ok: true; value: T }
  | { ok: false; error: "invalid_json" }
> {
  try {
    const value = (await request.json()) as T;
    return { ok: true, value };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}


