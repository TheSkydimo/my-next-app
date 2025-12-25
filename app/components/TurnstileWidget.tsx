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
  onTimeout,
  onBeforeInteractive,
  onAfterInteractive,
  theme = "auto",
  size = "normal",
  resetNonce,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  onError?: (errorCode?: string) => void;
  onExpire?: () => void;
  onTimeout?: () => void;
  onBeforeInteractive?: () => void;
  onAfterInteractive?: () => void;
  theme?: TurnstileTheme;
  size?: TurnstileSize;
  resetNonce?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);

  // 回调用 ref 固定住，避免父组件重渲染导致 Turnstile widget 被销毁/重建（出现“勾不上”）
  const callbacksRef = useRef<{
    onToken: (token: string) => void;
    onError?: (errorCode?: string) => void;
    onExpire?: () => void;
    onTimeout?: () => void;
    onBeforeInteractive?: () => void;
    onAfterInteractive?: () => void;
  }>({ onToken, onError, onExpire, onTimeout, onBeforeInteractive, onAfterInteractive });

  useEffect(() => {
    callbacksRef.current = {
      onToken,
      onError,
      onExpire,
      onTimeout,
      onBeforeInteractive,
      onAfterInteractive,
    };
  }, [onAfterInteractive, onBeforeInteractive, onError, onExpire, onTimeout, onToken]);

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
      "error-callback": (errorCode?: unknown) => {
        callbacksRef.current.onToken("");
        callbacksRef.current.onError?.(
          typeof errorCode === "string" ? errorCode : errorCode ? String(errorCode) : undefined
        );
      },
      "timeout-callback": () => {
        callbacksRef.current.onToken("");
        callbacksRef.current.onTimeout?.();
      },
      // NOTE: 这些回调在官方文档中不总是显式列出，但在部分集成/实现中存在；
      // 即使 Turnstile 忽略未知字段，也不会影响正常流程。
      "before-interactive-callback": () => {
        callbacksRef.current.onBeforeInteractive?.();
      },
      "after-interactive-callback": () => {
        callbacksRef.current.onAfterInteractive?.();
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

  // Allow parent to reset the widget without remounting.
  useEffect(() => {
    if (!scriptReady) return;
    const id = widgetIdRef.current;
    if (!id) return;
    if (!window.turnstile?.reset) return;
    // resetNonce is a "signal" - only act when it's provided/changes.
    if (typeof resetNonce !== "number") return;
    try {
      window.turnstile.reset(id);
    } catch {
      // ignore
    } finally {
      callbacksRef.current.onToken("");
    }
  }, [resetNonce, scriptReady]);

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
          callbacksRef.current.onError?.("script-load-failed");
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


