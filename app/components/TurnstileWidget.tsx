"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>
      ) => string;
      reset?: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

export type TurnstileTheme = "light" | "dark" | "auto";
export type TurnstileSize = "normal" | "compact";

export function TurnstileWidget({
  siteKey,
  onToken,
  onError,
  onExpire,
  theme = "auto",
  size = "normal",
}: {
  siteKey: string;
  onToken: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  theme?: TurnstileTheme;
  size?: TurnstileSize;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);

  // 回调用 ref 固定住，避免父组件重渲染导致 Turnstile widget 被销毁/重建（出现“勾不上”）
  const callbacksRef = useRef<{
    onToken: (token: string) => void;
    onError?: () => void;
    onExpire?: () => void;
  }>({ onToken, onError, onExpire });

  useEffect(() => {
    callbacksRef.current = { onToken, onError, onExpire };
  }, [onError, onExpire, onToken]);

  // If Turnstile script is already present (e.g. component remount due to React key),
  // Next.js <Script> may not fire onLoad again. In that case, mark ready immediately.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.turnstile?.render) {
      setScriptReady(true);
      setScriptFailed(false);
    }
  }, []);

  const options = useMemo(() => {
    return {
      sitekey: siteKey,
      theme,
      size,
      callback: (token: string) => callbacksRef.current.onToken(token),
      "expired-callback": () => {
        callbacksRef.current.onToken("");
        callbacksRef.current.onExpire?.();
      },
      "error-callback": () => {
        callbacksRef.current.onToken("");
        callbacksRef.current.onError?.();
      },
    } as const;
  }, [siteKey, size, theme]);

  useEffect(() => {
    if (!scriptReady) return;
    if (!containerRef.current) return;
    if (!window.turnstile?.render) return;
    if (widgetIdRef.current) return;
    if (!siteKey) return;

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, options);
    } catch {
      callbacksRef.current.onToken("");
      callbacksRef.current.onError?.();
      widgetIdRef.current = null;
      return;
    }

    return () => {
      const id = widgetIdRef.current;
      widgetIdRef.current = null;
      if (id && window.turnstile?.remove) {
        try {
          window.turnstile.remove(id);
        } catch {
          // ignore
        }
      }
    };
  }, [options, scriptReady, siteKey]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => {
          setScriptReady(true);
          setScriptFailed(false);
        }}
        onError={() => {
          setScriptReady(false);
          setScriptFailed(true);
          callbacksRef.current.onToken("");
          callbacksRef.current.onError?.();
        }}
      />
      {!siteKey ? (
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Turnstile site key is missing.
        </div>
      ) : scriptFailed ? (
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Turnstile 加载失败，请检查网络/广告拦截器后刷新页面重试。
        </div>
      ) : (
        <div ref={containerRef} />
      )}
    </>
  );
}


