export type LogEntry = {
  ts: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  event?: string;
  requestId?: string;
  method?: string;
  pathname?: string;
  queryKeys?: string[];
  status?: number;
  durationMs?: number;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
  err?: {
    name?: string;
    message?: string;
    stack?: string;
  };
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function makeUtcKeyPrefix(now: Date): string {
  return `logs/${now.getUTCFullYear()}/${pad2(now.getUTCMonth() + 1)}/${pad2(now.getUTCDate())}/${pad2(
    now.getUTCHours()
  )}`;
}

function normalizePrefix(prefix: string): string {
  const p = prefix.trim();
  if (!p) return "logs/";
  return p.endsWith("/") ? p : `${p}/`;
}

export async function archiveRequestLogsToR2(options: {
  bucket: R2Bucket | undefined;
  ctx: ExecutionContext | undefined;
  requestId: string;
  entries: LogEntry[];
  prefix?: string | undefined;
}): Promise<void> {
  const { bucket, ctx, requestId, entries } = options;
  if (!bucket) return;
  if (!entries.length) return;

  const now = new Date();
  const base = makeUtcKeyPrefix(now);
  const prefix = normalizePrefix(options.prefix ?? "logs/");
  const key = `${prefix}${base}/${requestId}.ndjson`;

  const body = `${entries.map((e) => JSON.stringify(e)).join("\n")}\n`;

  const putPromise = bucket.put(key, body, {
    httpMetadata: { contentType: "application/x-ndjson; charset=utf-8" },
  });

  // Prefer async background flush on Workers
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(putPromise);
    return;
  }

  await putPromise;
}


