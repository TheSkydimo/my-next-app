"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppLanguage } from "../client-prefs";
import { getUserMessages } from "../user-i18n";
import { useApiCache } from "../contexts/ApiCacheContext";

export type OrderSnapshot = {
  id: number;
  deviceId: string;
  imageUrl: string;
  note: string | null;
  createdAt: string;
  orderNo?: string | null;
  orderCreatedTime?: string | null;
  orderPaidTime?: string | null;
  platform?: string | null;
  shopName?: string | null;
  deviceCount?: number | null;
};

export function useUserOrdersPreview(email: string | null, language: AppLanguage) {
  const messages = useMemo(() => getUserMessages(language), [language]);
  const cache = useApiCache();

  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>("");
  const [items, setItems] = useState<OrderSnapshot[]>([]);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!email) {
        setItems([]);
        setError("");
        setLoaded(false);
        setLoading(false);
        return;
      }

      const url = `/api/user/orders?email=${encodeURIComponent(email)}`;
      const cached = cache.get<{ items?: OrderSnapshot[] }>(url);
      if (cached && Array.isArray(cached.items)) {
        setItems(cached.items);
        setError("");
        setLoaded(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoaded(false);
      setError("");

      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(messages.home.orderPreviewFetchFailed);
        }

        const data = (await res.json()) as { items?: OrderSnapshot[] };
        const list = Array.isArray(data.items) ? data.items : [];
        cache.set(url, { items: list });
        if (!ignore) setItems(list);
      } catch (e) {
        if (!ignore) {
          setItems([]);
          setError(e instanceof Error ? e.message : messages.home.orderPreviewFetchFailed);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setLoaded(true);
        }
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [cache, email, messages.home.orderPreviewFetchFailed]);

  return { loading, loaded, error, items };
}


