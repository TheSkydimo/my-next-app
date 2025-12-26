"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export const USER_BOOTSTRAP_SESSION_STORAGE_KEY = "user-dashboard-bootstrap:v1";

export type ApiCacheEntry = {
  value: unknown;
  updatedAt: number;
};

type ApiCacheState = Record<string, ApiCacheEntry>;

type ApiCacheContextValue = {
  /** Get cached value for a request key (usually the exact fetch URL). */
  get: <T,>(key: string) => T | undefined;
  /** Write cached value for a request key. */
  set: (key: string, value: unknown) => void;
  /** Remove a cached entry. */
  remove: (key: string) => void;
  /** Clear all cached entries. */
  clear: () => void;
};

const ApiCacheContext = createContext<ApiCacheContextValue | null>(null);

function safeParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function readAndClearBootstrapFromSessionStorage(): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(USER_BOOTSTRAP_SESSION_STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(USER_BOOTSTRAP_SESSION_STORAGE_KEY);
    return safeParseJson(raw);
  } catch {
    // If storage is blocked or quota exceeded, just skip bootstrap.
    return null;
  }
}

function seedCacheFromBootstrap(input: unknown): ApiCacheState {
  if (!input || typeof input !== "object") return {};

  const bootstrap = input as {
    ok?: boolean;
    user?: { email?: string };
    preloaded?: {
      orders?: { items?: unknown };
      devicesPage1?: unknown;
    };
  };

  if (!bootstrap.ok) return {};
  const email = bootstrap.user?.email;
  if (typeof email !== "string" || !email) return {};

  const now = Date.now();
  const state: ApiCacheState = {};

  // Seed orders list (used by Home preview + Devices page).
  const ordersItems = bootstrap.preloaded?.orders?.items;
  if (Array.isArray(ordersItems)) {
    const key = `/api/user/orders?email=${encodeURIComponent(email)}`;
    state[key] = { value: { items: ordersItems }, updatedAt: now };
  }

  // Seed devices first page (used by Devices page).
  const devicesPage1 = bootstrap.preloaded?.devicesPage1;
  if (devicesPage1 && typeof devicesPage1 === "object") {
    const key = `/api/user/devices?email=${encodeURIComponent(email)}&page=1`;
    state[key] = { value: devicesPage1, updatedAt: now };
  }

  return state;
}

export function ApiCacheProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ApiCacheState>(() => {
    const bootstrap = readAndClearBootstrapFromSessionStorage();
    return seedCacheFromBootstrap(bootstrap);
  });

  const get = useCallback(
    <T,>(key: string): T | undefined => {
      const entry = state[key];
      return (entry?.value as T | undefined) ?? undefined;
    },
    [state]
  );

  const set = useCallback((key: string, value: unknown) => {
    setState((prev) => ({
      ...prev,
      [key]: { value, updatedAt: Date.now() },
    }));
  }, []);

  const remove = useCallback((key: string) => {
    setState((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clear = useCallback(() => setState({}), []);

  const value = useMemo<ApiCacheContextValue>(() => ({ get, set, remove, clear }), [
    get,
    set,
    remove,
    clear,
  ]);

  return <ApiCacheContext.Provider value={value}>{children}</ApiCacheContext.Provider>;
}

export function useApiCache(): ApiCacheContextValue {
  const ctx = useContext(ApiCacheContext);
  if (!ctx) {
    throw new Error("useApiCache must be used within ApiCacheProvider");
  }
  return ctx;
}


