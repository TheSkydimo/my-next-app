"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

  const badgeText = useMemo(() => {
    if (unreadCount <= 0) return "";
    if (unreadCount > 99) return "99+";
    return String(unreadCount);
  }, [unreadCount]);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/notifications?page=1&pageSize=20", {
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
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

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
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    // 初次加载未读数/列表（轻量：直接拉一次 list）
    void fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
        aria-label="通知"
        title="通知"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="user-notif__icon">🔔</span>
        {badgeText && <span className="user-notif__badge">{badgeText}</span>}
      </button>

      {open && (
        <div className="user-notif__panel" role="dialog" aria-label="通知面板">
          <div className="user-notif__header">
            <div className="user-notif__title">通知</div>
            <div className="user-notif__header-actions">
              <button type="button" className="user-notif__link" onClick={() => void fetchList()}>
                刷新
              </button>
              <button
                type="button"
                className="user-notif__link"
                disabled={loading || unreadCount <= 0}
                onClick={() => void markAllRead()}
              >
                全部已读
              </button>
            </div>
          </div>

          {error && <div className="user-notif__error">{error}</div>}

          {loading ? (
            <div className="user-notif__empty">加载中...</div>
          ) : items.length === 0 ? (
            <div className="user-notif__empty">暂无通知</div>
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


