type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstileToken(opts: {
  secret: string;
  token: string;
  remoteip?: string | null;
}): Promise<boolean> {
  const form = new URLSearchParams();
  form.set("secret", opts.secret);
  form.set("response", opts.token);
  if (opts.remoteip) form.set("remoteip", opts.remoteip);

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    }
  );

  const data = (await res.json().catch(() => null)) as
    | TurnstileVerifyResponse
    | null;

  return !!data?.success;
}

export function getTurnstileSecretFromEnv(env: unknown): string {
  return String(
    (env as unknown as { TURNSTILE_SECRET_KEY?: string }).TURNSTILE_SECRET_KEY ??
      ""
  );
}


