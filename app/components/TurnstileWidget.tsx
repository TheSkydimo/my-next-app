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

  const options = useMemo(() => {
    return {
      sitekey: siteKey,
      theme,
      size,
      callback: (token: string) => onToken(token),
      "expired-callback": () => {
        onToken("");
        onExpire?.();
      },
      "error-callback": () => {
        onToken("");
        onError?.();
      },
    } as const;
  }, [onError, onExpire, onToken, siteKey, size, theme]);

  useEffect(() => {
    if (!scriptReady) return;
    if (!containerRef.current) return;
    if (!window.turnstile?.render) return;
    if (widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, options);

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
  }, [options, scriptReady]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => {
          setScriptReady(false);
          onToken("");
          onError?.();
        }}
      />
      <div ref={containerRef} />
    </>
  );
}


