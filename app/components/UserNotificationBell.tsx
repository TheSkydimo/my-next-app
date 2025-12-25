"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppLanguage } from "../client-prefs";
import { getInitialLanguage } from "../client-prefs";
import { getUserMessages } from "../user-i18n";

type NotificationItem = {
  id: number;
  type: string;
  level: "info" | "warn" | "critical";
  title: string;
  body: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function UserNotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const messages = useMemo(() => getUserMessages(language), [language]);

  const badgeText = useMemo(() => {
    if (unreadCount <= 0) return "";
    if (unreadCount > 99) return "99+";
    return String(unreadCount);
  }, [unreadCount]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "20",
        lang: language,
      });
      const res = await fetch(`/api/user/notifications?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        items?: NotificationItem[];
        unreadCount?: number;
      };
      setItems(data.items ?? []);
      setUnreadCount(Number(data.unreadCount ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.notifications.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [language, messages.notifications.loadFailed]);

  const markRead = async (id: number) => {
    try {
      const res = await fetch(`/api/user/notifications/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/notifications", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.common.unknownError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ language: AppLanguage }>;
      if (custom.detail?.language) setLanguage(custom.detail.language);
    };
    window.addEventListener("app-language-changed", handler as EventListener);
    return () => window.removeEventListener("app-language-changed", handler as EventListener);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // 初次加载未读数/列表（轻量：直接拉一次 list）
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (!open) return;
    void fetchList();
  }, [open, fetchList]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = panelRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && el.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="user-notif" ref={panelRef}>
      <button
        type="button"
        className="user-topbar__icon-btn user-notif__btn"
        aria-label={messages.notifications.ariaLabel}
        title={messages.notifications.ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="user-notif__icon">🔔</span>
        {badgeText && <span className="user-notif__badge">{badgeText}</span>}
      </button>

      {open && (
        <div
          className="user-notif__panel"
          role="dialog"
          aria-label={messages.notifications.panelAriaLabel}
        >
          <div className="user-notif__header">
            <div className="user-notif__title">{messages.notifications.title}</div>
            <div className="user-notif__header-actions">
              <button type="button" className="user-notif__link" onClick={() => void fetchList()}>
                {messages.notifications.refresh}
              </button>
              <button
                type="button"
                className="user-notif__link"
                disabled={loading || unreadCount <= 0}
                onClick={() => void markAllRead()}
              >
                {messages.notifications.markAllRead}
              </button>
            </div>
          </div>

          {error && <div className="user-notif__error">{error}</div>}

          {loading ? (
            <div className="user-notif__empty">{messages.notifications.loadingText}</div>
          ) : items.length === 0 ? (
            <div className="user-notif__empty">{messages.notifications.emptyText}</div>
          ) : (
            <div className="user-notif__list">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`user-notif__item ${it.isRead ? "user-notif__item--read" : ""} user-notif__item--${it.level}`}
                  onClick={() => {
                    if (!it.isRead) void markRead(it.id);
                    if (it.linkUrl) window.location.href = it.linkUrl;
                  }}
                >
                  <div className="user-notif__item-top">
                    <div className="user-notif__item-title">
                      {!it.isRead && <span className="user-notif__dot" aria-hidden="true" />}
                      {it.title}
                    </div>
                    <div className="user-notif__item-time">{formatTime(it.createdAt)}</div>
                  </div>
                  <div className="user-notif__item-body">{it.body}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


