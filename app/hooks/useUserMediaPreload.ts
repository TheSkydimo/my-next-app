"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApiCache } from "../contexts/ApiCacheContext";
import { apiFetch } from "../lib/apiFetch";

type OrderSnapshot = {
  id: number;
  imageUrl: string;
};

function warmImage(url: string, warmed: Set<string>) {
  if (typeof window === "undefined") return;
  const u = (url ?? "").trim();
  if (!u) return;
  if (warmed.has(u)) return;
  warmed.add(u);

  // Best-effort warm-up: browser cache will handle reuse.
  const img = new window.Image();
  img.decoding = "async";
  img.loading = "eager";
  img.src = u;
}

export function useUserMediaPreload(opts: {
  enabled: boolean;
  avatarUrl: string | null;
  maxOrderImagesToWarm?: number;
}) {
  const { enabled, avatarUrl, maxOrderImagesToWarm = 6 } = opts;
  const cache = useApiCache();
  const router = useRouter();

  const warmedRef = useRef<Set<string>>(new Set());
  const maxWarm = useMemo(() => {
    const n = Math.floor(maxOrderImagesToWarm);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(n, 24);
  }, [maxOrderImagesToWarm]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    // Prefetch likely routes in the user console.
    try {
      router.prefetch("/profile");
      router.prefetch("/orders");
    } catch {
      // ignore (best-effort)
    }

    // Warm avatar image.
    if (avatarUrl) warmImage(avatarUrl, warmedRef.current);

    // Warm orders JSON + first N order images.
    const url = "/api/user/orders";
    const ctrl = new AbortController();
    const timeout = window.setTimeout(() => ctrl.abort(), 1500);

    const run = async () => {
      try {
        const cached = cache.get<{ items?: OrderSnapshot[] }>(url);
        const listFromCache = Array.isArray(cached?.items) ? cached!.items! : null;
        if (listFromCache) {
          for (const it of listFromCache.slice(0, maxWarm)) {
            if (it?.imageUrl) warmImage(it.imageUrl, warmedRef.current);
          }
          return;
        }

        const res = await apiFetch(url, { method: "GET", signal: ctrl.signal });
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as { items?: OrderSnapshot[] } | null;
        const items = Array.isArray(data?.items) ? data!.items! : [];
        cache.set(url, { items });

        for (const it of items.slice(0, maxWarm)) {
          if (it?.imageUrl) warmImage(it.imageUrl, warmedRef.current);
        }
      } catch {
        // ignore (best-effort)
      }
    };

    void run().finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      ctrl.abort();
    };
  }, [avatarUrl, cache, enabled, maxWarm, router]);
}


