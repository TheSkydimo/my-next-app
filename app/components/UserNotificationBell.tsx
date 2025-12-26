"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Badge, 
  Button, 
  Popover, 
  List, 
  Typography, 
  Spin, 
  Empty, 
  Space, 
  Tag, 
  theme 
} from "antd";
import { 
  BellOutlined, 
  CheckOutlined, 
  ReloadOutlined 
} from "@ant-design/icons";
import type { AppLanguage } from "../client-prefs";
import { getInitialLanguage } from "../client-prefs";
import { getUserMessages } from "../user-i18n";

const { Text } = Typography;
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);
  
  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const messages = useMemo(() => getUserMessages(language), [language]);
  const { token } = useToken();

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
    void fetchList();
  }, [fetchList]);

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
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text strong={!item.isRead}>
                      {!item.isRead && <Badge status="processing" style={{ marginRight: 8 }} />}
                      {item.title}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{formatTime(item.createdAt)}</Text>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <Text type="secondary" ellipsis={{ tooltip: item.body }}>{item.body}</Text>
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
