"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Typography, Button, Alert, Card } from "antd";
import { CloudUploadOutlined } from "@ant-design/icons";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getUserMessages } from "../../user-i18n";
import { useUser } from "../../contexts/UserContext";
import { useApiCache } from "../../contexts/ApiCacheContext";
import { useAutoDismissMessage } from "../../hooks/useAutoDismissMessage";
import UserOrdersList, { OrderSnapshot } from "../../components/UserOrdersList";
import OrderUploadModal from "../../components/OrderUploadModal";
import { apiFetch } from "../../lib/apiFetch";
import {
  USER_ORDERS_INVALIDATED_EVENT,
  type UserOrdersInvalidatedDetail,
} from "../../lib/events/userOrdersEvents";

// 与后端 `app/api/user/orders/route.ts` 中的 DEFAULT_DEVICE_ID 保持一致
const NO_DEVICE_ID = "__NO_DEVICE__";

export default function UserDevicesPage() {
  const userContext = useUser();
  const userEmail = userContext.profile?.email ?? null;
  const isUserInitialized = userContext.initialized;
  const cache = useApiCache();

  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useAutoDismissMessage(2000);
  const [okMsg, setOkMsg] = useAutoDismissMessage(2000);

  const [uploadingOrderForDevice, setUploadingOrderForDevice] = useState<string | null>(null);
  const [orders, setOrders] = useState<Record<string, OrderSnapshot[]>>({});
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const messages = getUserMessages(language);

  // Language & Data Loading Effects
  useEffect(() => {
    if (typeof window === "undefined") return;
    setLanguage(getInitialLanguage());
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ language: AppLanguage }>;
      if (custom.detail?.language) setLanguage(custom.detail.language);
    };
    window.addEventListener("app-language-changed", handler as EventListener);
    return () => window.removeEventListener("app-language-changed", handler as EventListener);
  }, []);

  const applyOrders = useCallback((list: OrderSnapshot[]) => {
    const grouped: Record<string, OrderSnapshot[]> = {};
    for (const item of list) {
      const key = item.deviceId || NO_DEVICE_ID;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }
    setOrders(grouped);
  }, []);

  const loadOrders = useCallback(
    async (opts?: { bypassCache?: boolean }) => {
      const url = `/api/user/orders`;

      try {
        const bypassCache = !!opts?.bypassCache;
        const cached = bypassCache ? undefined : cache.get<{ items?: OrderSnapshot[] }>(url);
        if (cached && Array.isArray(cached.items)) {
          applyOrders(cached.items);
          return;
        }

        setLoading(true);
        const res = await apiFetch(url);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || (language === "zh-CN" ? "获取订单失败" : "Failed to load orders"));
        }
        const json = (await res.json()) as { items?: OrderSnapshot[] };
        const list = Array.isArray(json.items) ? json.items : [];
        cache.set(url, { items: list });
        applyOrders(list);
      } catch (e: unknown) {
        setError(
          e instanceof Error
            ? e.message
            : language === "zh-CN"
              ? "获取订单失败"
              : "Failed to load orders"
        );
      } finally {
        setLoading(false);
      }
    },
    [applyOrders, cache, language, setError]
  );

  useEffect(() => {
    if (userEmail) void loadOrders();
  }, [loadOrders, userEmail]);

  // When admin removes an order screenshot, user gets a notification.
  // We listen to a lightweight front-end event (dispatched by UserNotificationBell polling)
  // and refresh orders automatically (cache-first, but invalidate on signal).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (event: Event) => {
      if (!userEmail) return;
      const custom = event as CustomEvent<UserOrdersInvalidatedDetail>;
      const source = custom.detail?.source ?? "unknown";

      // Invalidate cache and force a refresh.
      cache.remove("/api/user/orders");
      void loadOrders({ bypassCache: true });

      // Optional UX: a small hint that data has changed.
      if (source === "notification") {
        setOkMsg(language === "zh-CN" ? "订单已更新" : "Orders updated");
      }
    };

    window.addEventListener(USER_ORDERS_INVALIDATED_EVENT, handler as EventListener);
    return () => window.removeEventListener(USER_ORDERS_INVALIDATED_EVENT, handler as EventListener);
  }, [cache, language, loadOrders, setOkMsg, userEmail]);

  const allOrders = useMemo(() => {
    const flat = Object.values(orders).flat();
    return flat.sort((a, b) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return (Number.isNaN(bt) ? 0 : bt) - (Number.isNaN(at) ? 0 : at);
    });
  }, [orders]);

  const ordersCacheUrl = userEmail
    ? `/api/user/orders`
    : null;

  // Delete Order Logic
  const handleDeleteOrder = async (order: OrderSnapshot) => {
    if (!userEmail) return;
    try {
      const res = await apiFetch("/api/user/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || (language === "zh-CN" ? "删除失败" : "Delete failed"));
      }

      let nextOrders: Record<string, OrderSnapshot[]> | null = null;
      setOrders((prev) => {
        const key = order.deviceId || NO_DEVICE_ID;
        const list = prev[key] ?? [];
        const nextList = list.filter((item) => item.id !== order.id);
        const next = { ...prev };
        if (nextList.length > 0) next[key] = nextList;
        else delete next[key];
        nextOrders = next;
        return next;
      });

      // 写操作成功后：强制同步缓存，避免切页后读到旧数据
      if (ordersCacheUrl && nextOrders) {
        const flat = Object.values(nextOrders).flat();
        cache.set(ordersCacheUrl, { items: flat });
      }
      setOkMsg(language === "zh-CN" ? "删除成功" : "Deleted successfully");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (language === "zh-CN" ? "删除失败" : "Delete failed"));
    }
  };

  // Upload Logic Wrapper
  const handleUploadSuccess = (data: OrderSnapshot) => {
    let nextOrders: Record<string, OrderSnapshot[]> | null = null;
    setOrders((prev) => {
      const key = data.deviceId || NO_DEVICE_ID;
      const list = prev[key] ?? [];
      const deduped = [data, ...list.filter((x) => x.id !== data.id)];
      const next = { ...prev, [key]: deduped };
      nextOrders = next;
      return next;
    });

    // 写操作成功后：强制同步缓存，避免切页后读到旧数据
    if (ordersCacheUrl && nextOrders) {
      const flat = Object.values(nextOrders).flat();
      cache.set(ordersCacheUrl, { items: flat });
    }
    setUploadingOrderForDevice(null);
  };

  if (!isUserInitialized) {
    return (
      <div className="vben-page">
        <p>{messages.common.loading}</p>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="vben-page">
        <p>{messages.common.loginRequired}</p>
        <Link href="/login">{messages.common.goLogin}</Link>
      </div>
    );
  }

  return (
    <div className="vben-page">
      <div className="vben-page__header">
        <h1 className="vben-page__title">{messages.orders.title}</h1>
        <p className="vben-page__subtitle">
          {language === "zh-CN"
            ? "上传订单截图并管理你的订单信息。"
            : "Upload order screenshots and manage your order records."}
        </p>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
          style={{ marginTop: 12 }}
        />
      )}
      {okMsg && (
        <Alert
          type="success"
          message={okMsg}
          showIcon
          style={{ marginTop: 12 }}
        />
      )}

      {/* 订单信息区块：由左侧菜单/Hash 控制是否显示（避免与菜单重复） */}
      <section
        id="order-section"
        className="user-page-section"
        style={{ marginTop: 24 }}
      >
        <Card>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "12px 0",
              textAlign: "center",
            }}
          >
            <Typography.Text type="secondary">
              {language === "zh-CN"
                ? "上传订单截图以便系统识别并记录订单信息"
                : "Upload order screenshots so we can extract and store your order info"}
            </Typography.Text>
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              size="large"
              onClick={() => {
                setUploadingOrderForDevice(null);
                setIsUploadModalOpen(true);
              }}
            >
              {language === "zh-CN" ? "上传订单截图" : "Upload Order Screenshot"}
            </Button>
          </div>
        </Card>

        <div className="user-page-section" style={{ marginTop: 16, padding: 0 }}>
          <Card style={{ width: "100%" }} styles={{ body: { paddingTop: 12 } }}>
            <UserOrdersList
              language={language}
              items={allOrders}
              onDelete={handleDeleteOrder}
              loading={loading}
            />
          </Card>
        </div>
      </section>

      <OrderUploadModal 
        open={isUploadModalOpen}
        onClose={() => {
            setIsUploadModalOpen(false);
            setUploadingOrderForDevice(null);
        }}
        onSuccess={handleUploadSuccess}
        deviceId={uploadingOrderForDevice}
        language={language}
      />
    </div>
  );
}
