import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A tiny client-side message state helper:
 * - set message -> auto clears after `timeoutMs`
 * - set "" -> clears immediately and cancels pending timer
 */
export function useAutoDismissMessage(timeoutMs = 2000) {
  const [message, setMessageState] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setMessageState("");
  }, []);

  const setMessage = useCallback(
    (next: string) => {
      const value = String(next ?? "");
      if (!value) {
        clear();
        return;
      }

      setMessageState(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setMessageState("");
        timerRef.current = null;
      }, timeoutMs);
    },
    [clear, timeoutMs]
  );

  useEffect(() => clear, [clear]);

  return [message, setMessage, clear] as const;
}


