"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge, 
  Button, 
  Popconfirm,
  Popover, 
  List, 
  Typography, 
  Spin, 
  Empty, 
  Space, 
  Tag, 
  message,
  theme 
} from "antd";
import { 
  BellOutlined, 
  CheckOutlined, 
  ReloadOutlined,
  DeleteOutlined
} from "@ant-design/icons";
import type { AppLanguage } from "../client-prefs";
import { getInitialLanguage } from "../client-prefs";
import { getUserMessages } from "../user-i18n";
import { apiFetch } from "../lib/apiFetch";
import { dispatchUserOrdersInvalidated } from "../lib/events/userOrdersEvents";
import { formatDateTime, getClientTimeZone } from "../_utils/dateTime";

const { Text, Paragraph } = Typography;
const { useToken } = theme;

const TOPBAR_ICON_BTN_STYLE: React.CSSProperties = {
  width: 30,
  height: 30,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const TOPBAR_ICON_SIZE = 16;

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

export default function UserNotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);
  
  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const messages = useMemo(() => getUserMessages(language), [language]);
  const { token } = useToken();
  const viewerTz = useMemo(() => getClientTimeZone(), []);

  // Track notifications we've seen to avoid firing on initial load.
  // Note: lastSeen may be 0 when there are no notifications yet; that's still "initialized".
  const notifSeenRef = useRef<{ initialized: boolean; lastSeenId: number }>({
    initialized: false,
    lastSeenId: 0,
  });

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "20",
        lang: language,
      });
      const res = await apiFetch(`/api/user/notifications?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        items?: NotificationItem[];
        unreadCount?: number;
      };
      const list = data.items ?? [];
      setItems(list);
      setUnreadCount(Number(data.unreadCount ?? 0));

      // Initialize seen-id on first successful fetch (avoid triggering refresh on historical items).
      if (!notifSeenRef.current.initialized) {
        const maxId = list.reduce((m, x) => Math.max(m, x.id), 0);
        notifSeenRef.current = { initialized: true, lastSeenId: maxId };
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.notifications.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [language, messages.notifications.loadFailed]);

  const probeUnreadAndDispatchEvents = useCallback(async () => {
    // Lightweight poll: only unread notifications.
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "20",
        unreadOnly: "1",
        lang: language,
      });
      const res = await apiFetch(`/api/user/notifications?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        items?: NotificationItem[];
        unreadCount?: number;
      };

      const list = data.items ?? [];
      setUnreadCount(Number(data.unreadCount ?? 0));

      // If we haven't initialized yet (e.g. initial fetchList not completed), initialize and don't dispatch.
      if (!notifSeenRef.current.initialized) {
        const maxId = list.reduce((m, x) => Math.max(m, x.id), 0);
        notifSeenRef.current = { initialized: true, lastSeenId: maxId };
        return;
      }

      const lastSeen = notifSeenRef.current.lastSeenId;
      const newItems = list.filter((x) => x.id > lastSeen);
      const newOrderRelated = newItems.filter((x) => x.type === "order_removed");
      if (newOrderRelated.length > 0) {
        dispatchUserOrdersInvalidated({
          source: "notification",
          notificationIds: newOrderRelated.map((x) => x.id),
          notificationTypes: Array.from(new Set(newOrderRelated.map((x) => x.type))),
        });
      }

      // Merge new unread items into the current list (so user doesn't need to hit refresh).
      if (newItems.length > 0) {
        setItems((prev) => {
          const map = new Map<number, NotificationItem>();
          for (const it of prev) map.set(it.id, it);
          for (const it of newItems) map.set(it.id, it);
          // Sort newest first by id (consistent with API ordering).
          return Array.from(map.values()).sort((a, b) => b.id - a.id).slice(0, 20);
        });

        // If the panel is closed, show a small toast to hint the user.
        if (!open) {
          const newest = newItems.reduce((acc, it) => (it.id > acc.id ? it : acc), newItems[0]);
          message.info({
            content: newest.title || (language === "zh-CN" ? "收到新通知" : "New notification"),
            duration: 2,
          });
        }
      }

      const maxId = list.reduce((m, x) => Math.max(m, x.id), 0);
      if (maxId > notifSeenRef.current.lastSeenId) {
        notifSeenRef.current = { initialized: true, lastSeenId: maxId };
      }
    } catch {
      // silent (best-effort)
    }
  }, [language, open]);

  const markRead = async (id: number) => {
    try {
      const res = await apiFetch(`/api/user/notifications/${id}`, {
        method: "PATCH",
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
      const res = await apiFetch("/api/user/notifications", {
        method: "POST",
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

  const clearAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/user/notifications", { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setItems([]);
      setUnreadCount(0);
      message.success(messages.notifications.clearAllSuccess);
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.notifications.clearAllFailed);
      message.error(messages.notifications.clearAllFailed);
    } finally {
      setLoading(false);
    }
  };

  const deleteOne = async (id: number, wasUnread: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/user/notifications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) => prev.filter((x) => x.id !== id));
      // If it was unread, decrement count (best-effort; avoid negative).
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
      message.success(messages.notifications.deleteOneSuccess);
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.notifications.deleteOneFailed);
      message.error(messages.notifications.deleteOneFailed);
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
    void fetchList();
  }, [fetchList]);

  // Background polling to keep unread count fresh and to auto-refresh order data when admin removes an order.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      // Avoid duplicate requests while the panel is open; open state already triggers fetchList.
      if (open) return;
      void probeUnreadAndDispatchEvents();
    };

    const intervalId = window.setInterval(tick, 15_000);
    const onVis = () => tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [open, probeUnreadAndDispatchEvents]);

  // 当面板打开时，重新拉取一次
  useEffect(() => {
    if (open) {
      void fetchList();
    }
  }, [open, fetchList]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'error';
      case 'warn': return 'warning';
      case 'info': return 'processing';
      default: return 'default';
    }
  };

  const content = (
    <div style={{ width: 360, maxHeight: 500, display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`
      }}>
        <Text strong>{messages.notifications.title}</Text>
        <Space>
          <Popconfirm
            title={messages.notifications.clearAllConfirmTitle}
            description={messages.notifications.clearAllConfirmDesc}
            okText={messages.notifications.clearAllOk}
            cancelText={messages.notifications.clearAllCancel}
            onConfirm={() => void clearAll()}
            disabled={items.length <= 0 || loading}
          >
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              disabled={items.length <= 0 || loading}
              title={messages.notifications.clearAll}
            />
          </Popconfirm>
          <Button 
            type="text" 
            size="small" 
            icon={<ReloadOutlined />} 
            onClick={() => void fetchList()}
            title={messages.notifications.refresh}
          />
          <Button 
            type="text" 
            size="small" 
            icon={<CheckOutlined />} 
            disabled={unreadCount <= 0}
            onClick={() => void markAllRead()}
            title={messages.notifications.markAllRead}
          >
             {messages.notifications.markAllRead}
          </Button>
        </Space>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400 }}>
        {loading && items.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : items.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={messages.notifications.emptyText} />
        ) : (
          <List
            dataSource={items}
            renderItem={(item) => (
              <List.Item 
                style={{ 
                  padding: '12px 16px',
                  cursor: 'pointer',
                  backgroundColor: item.isRead ? 'transparent' : token.colorBgLayout,
                  transition: 'background 0.3s',
                }}
                className="hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => {
                  if (!item.isRead) void markRead(item.id);
                  if (item.linkUrl) window.location.href = item.linkUrl;
                }}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
                    <Text strong={!item.isRead}>
                      {!item.isRead && <Badge status="processing" style={{ marginRight: 8 }} />}
                      {item.title}
                    </Text>
                    <Space size={4}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatDateTime(item.createdAt, {
                          locale: language,
                          timeZone: viewerTz ?? undefined,
                        })}
                      </Text>
                      <Popconfirm
                        title={messages.notifications.deleteOneConfirmTitle}
                        okText={messages.notifications.deleteOneOk}
                        cancelText={messages.notifications.deleteOneCancel}
                        onConfirm={(e) => {
                          e?.stopPropagation?.();
                          void deleteOne(item.id, !item.isRead);
                        }}
                        disabled={loading}
                      >
                        <Button
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          title={messages.notifications.deleteOne}
                          disabled={loading}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    </Space>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <Paragraph
                      type="secondary"
                      style={{ marginBottom: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                      ellipsis={{ rows: 3, tooltip: item.body }}
                    >
                      {item.body}
                    </Paragraph>
                  </div>
                  {item.level !== 'info' && (
                    <Tag color={getLevelColor(item.level)} bordered={false} style={{ fontSize: 10, lineHeight: '18px' }}>
                      {item.level.toUpperCase()}
                    </Tag>
                  )}
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      overlayInnerStyle={{ padding: 0 }}
      arrow={false}
    >
      <Button
        type="text"
        aria-label={messages.notifications.ariaLabel}
        title={messages.notifications.title}
        style={TOPBAR_ICON_BTN_STYLE}
        icon={
          <Badge count={unreadCount} overflowCount={99} size="small">
            <BellOutlined style={{ fontSize: TOPBAR_ICON_SIZE, lineHeight: 1 }} />
          </Badge>
        }
      />
    </Popover>
  );
}
