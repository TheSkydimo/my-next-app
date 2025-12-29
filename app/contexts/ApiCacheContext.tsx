"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export const USER_BOOTSTRAP_SESSION_STORAGE_KEY = "user-dashboard-bootstrap:v1";
export const ADMIN_BOOTSTRAP_SESSION_STORAGE_KEY = "admin-dashboard-bootstrap:v1";

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

function readAndClearBootstrapFromSessionStorage(storageKey: string): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    window.sessionStorage.removeItem(storageKey);
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
    cacheSeed?: Record<string, unknown>;
  };

  if (!bootstrap.ok) return {};
  const now = Date.now();

  // Generic fast-path: allow server to provide exact URL->JSON seeds.
  if (bootstrap.cacheSeed && typeof bootstrap.cacheSeed === "object") {
    const out: ApiCacheState = {};
    for (const [key, value] of Object.entries(bootstrap.cacheSeed)) {
      if (typeof key !== "string" || !key) continue;
      out[key] = { value, updatedAt: now };
    }
    return out;
  }
  return {};
}

export function ApiCacheProvider(props: {
  children: React.ReactNode;
  bootstrapStorageKey?: string;
}) {
  const { children, bootstrapStorageKey = USER_BOOTSTRAP_SESSION_STORAGE_KEY } = props;
  const [state, setState] = useState<ApiCacheState>(() => {
    const bootstrap = readAndClearBootstrapFromSessionStorage(bootstrapStorageKey);
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


