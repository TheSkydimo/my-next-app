"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Typography, Button, Alert, Empty, Pagination, Table, Tag, Card } from "antd";
import { CloudUploadOutlined, FileTextOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import type { TableProps } from "antd";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getUserMessages } from "../../user-i18n";
import { useUser } from "../../contexts/UserContext";
import { useApiCache } from "../../contexts/ApiCacheContext";
import { useAutoDismissMessage } from "../../hooks/useAutoDismissMessage";
import UserOrdersList, { OrderSnapshot } from "../../components/UserOrdersList";
import OrderUploadModal from "../../components/OrderUploadModal";

const { Text } = Typography;

type Device = {
  id: number;
  deviceId: string;
  warrantyExpiresAt: string;
};

type DevicesApiResponse =
  | Device[]
  | {
      items?: Device[];
      total?: number;
    };

type WarrantyRow = {
  key: number;
  idDisplay: string;
  shopName: string;
  warrantyDate: Date;
};

// 与后端 `app/api/user/orders/route.ts` 中的 DEFAULT_DEVICE_ID 保持一致
const NO_DEVICE_ID = "__NO_DEVICE__";

export default function UserDevicesPage() {
  const userContext = useUser();
  const userEmail = userContext.profile?.email ?? null;
  const isUserInitialized = userContext.initialized;
  const cache = useApiCache();

  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useAutoDismissMessage(2000);
  const [okMsg, setOkMsg] = useAutoDismissMessage(2000);
  const [page, setPage] = useState(1);
  const [deviceTotal, setDeviceTotal] = useState(0);
  const pageSize = 5;

  const [uploadingOrderForDevice, setUploadingOrderForDevice] = useState<string | null>(null);
  const [orders, setOrders] = useState<Record<string, OrderSnapshot[]>>({});
  
  // Section state synced with hash / left menu
  const [activeSection, setActiveSection] = useState<"order" | "warranty">("order");
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const messages = getUserMessages(language);

  // Sync section with hash and left-menu event
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromHash = () => {
      const hash = window.location.hash;
      if (hash === "#warranty-section") {
        setActiveSection("warranty");
      } else {
        setActiveSection("order");
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ section: "order" | "warranty" }>;
      const section = custom.detail?.section;
      if (section === "order") {
        setActiveSection("order");
        if (window.location.hash !== "#order-section") window.location.hash = "#order-section";
      } else if (section === "warranty") {
        setActiveSection("warranty");
        if (window.location.hash !== "#warranty-section") window.location.hash = "#warranty-section";
      }
    };

    window.addEventListener("user-devices-section-changed", handler as EventListener);

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("user-devices-section-changed", handler as EventListener);
    };
  }, []);

  // Warranty Calculation Logic
  const getWarrantyExpiresAt = (device: Device): Date => {
    const deviceOrders = orders[device.deviceId] ?? [];
    const paidDates: Date[] = [];

    for (const o of deviceOrders) {
      if (!o.orderPaidTime) continue;
      const raw = o.orderPaidTime.trim();
      if (!raw) continue;
      const normalized = raw.includes("T") || raw.endsWith("Z") ? raw : raw.replace(" ", "T");
      const d = new Date(normalized);
      if (!Number.isNaN(d.getTime())) {
        paidDates.push(d);
      }
    }

    if (paidDates.length > 0) {
      let earliest = paidDates[0];
      for (const d of paidDates) {
        if (d.getTime() < earliest.getTime()) {
          earliest = d;
        }
      }
      const warranty = new Date(earliest);
      warranty.setMonth(warranty.getMonth() + 18);
      return warranty;
    }

    return new Date(device.warrantyExpiresAt);
  };

  const getWarrantyFromOrder = (o: OrderSnapshot): Date => {
    const raw = o.orderPaidTime?.trim() || o.orderCreatedTime?.trim() || o.createdAt?.trim();

    if (raw) {
      const normalized = raw.includes("T") || raw.endsWith("Z") ? raw : raw.replace(" ", "T");
      const base = new Date(normalized);
      if (!Number.isNaN(base.getTime())) {
        const warranty = new Date(base);
        warranty.setMonth(warranty.getMonth() + 18);
        return warranty;
      }
    }

    const now = new Date();
    now.setMonth(now.getMonth() + 18);
    return now;
  };

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

  useEffect(() => {
    const loadDevices = async (pageNumber: number) => {
      const url = `/api/user/devices?page=${pageNumber}`;

      const cached = cache.get<unknown>(url);
      if (cached) {
        try {
          const parsed = cached as DevicesApiResponse;
          if (Array.isArray(parsed)) {
            setDevices(parsed);
            setDeviceTotal(parsed.length);
            setPage(1);
          } else {
            const items = parsed.items ?? [];
            setDevices(items);
            setDeviceTotal(
              typeof parsed.total === "number" ? parsed.total : items.length
            );
          }
          setLoading(false);
          return;
        } catch {
          // ignore cache parse issues and fall back to network
        }
      }

      setLoading(true);
      try {
        const res = await fetch(url);
        if (!res.ok) {
           if (res.status === 404) {
             setDevices([]);
             setDeviceTotal(0);
             return;
           }
           const text = await res.text();
           throw new Error(text || messages.devices.fetchFailed);
        }
        const data: unknown = await res.json();
        cache.set(url, data);
        const parsed = data as DevicesApiResponse;
        if (Array.isArray(parsed)) {
          setDevices(parsed);
          setDeviceTotal(parsed.length);
          setPage(1);
        } else {
          const items = parsed.items ?? [];
          setDevices(items);
          setDeviceTotal(typeof parsed.total === "number" ? parsed.total : items.length);
        }
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : messages.devices.fetchFailed
        );
      } finally {
        setLoading(false);
      }
    };

    if (userEmail) loadDevices(page);
  }, [cache, messages.devices.fetchFailed, page, setError, userEmail]);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const url = `/api/user/orders`;
        const cached = cache.get<{ items?: OrderSnapshot[] }>(url);
        const data = cached
          ? cached
          : ((await (async () => {
              const res = await fetch(url);
              if (!res.ok) return null;
              const json = (await res.json()) as { items?: OrderSnapshot[] };
              cache.set(url, { items: Array.isArray(json.items) ? json.items : [] });
              return json;
            })()) ?? null);

        if (!data) return;
        const list = Array.isArray(data.items) ? data.items : [];
        const grouped: Record<string, OrderSnapshot[]> = {};
        for (const item of list) {
          if (!grouped[item.deviceId]) grouped[item.deviceId] = [];
          grouped[item.deviceId].push(item);
        }
        setOrders(grouped);
      } catch {}
    };
    if (userEmail) loadOrders();
  }, [cache, userEmail]);

  // Data Processing
  const getUniqueOrders = (): OrderSnapshot[] => {
    const map = new Map<string, OrderSnapshot>();
    Object.values(orders).forEach((list) => {
      list.forEach((o) => {
        const key = (o.orderNo || String(o.id)).trim();
        if (!map.has(key)) map.set(key, o);
      });
    });
    return Array.from(map.values());
  };

  const uniqueOrders = getUniqueOrders();
  const totalOrders = uniqueOrders.length;
  const hasOrderData = totalOrders > 0;
  const totalRowsForPaging = hasOrderData ? totalOrders : deviceTotal;
  const ordersCacheUrl = userEmail
    ? `/api/user/orders`
    : null;

  // Delete Order Logic
  const handleDeleteOrder = async (order: OrderSnapshot) => {
    if (!userEmail) return;
    try {
      const res = await fetch("/api/user/orders", {
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

  // Warranty Table Columns
  const warrantyColumns: TableProps<WarrantyRow>["columns"] = [
    {
      title: language === "zh-CN" ? "序号" : "No.",
      key: "index",
      width: 60,
      render: (_, __, index) => (page - 1) * pageSize + index + 1,
    },
    {
      title: language === "zh-CN" ? "设备ID / 订单号" : "Device ID / Order No",
      dataIndex: "idDisplay",
      key: "idDisplay",
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: language === "zh-CN" ? "店铺" : "Shop",
      dataIndex: "shopName",
      key: "shopName",
      render: (text) => text || "-",
    },
    {
      title: language === "zh-CN" ? "质保到期" : "Warranty Expires",
      dataIndex: "warrantyDate",
      key: "warrantyDate",
      render: (date: Date) => (
        <Tag color={date > new Date() ? "success" : "error"}>
          {date.toLocaleDateString()}
        </Tag>
      ),
    },
  ];

  const getWarrantyDataSource = () => {
    if (uniqueOrders.length > 0) {
      const start = (page - 1) * pageSize;
      return uniqueOrders.slice(start, start + pageSize).map((o) => ({
        key: o.id,
        idDisplay: o.orderNo ?? String(o.id),
        shopName: o.shopName ?? "-",
        warrantyDate: getWarrantyFromOrder(o),
      }));
    } else if (devices.length > 0) {
        // Fallback to devices if no orders
      return devices.map((d) => ({
        key: d.id,
        idDisplay: d.deviceId,
        shopName: "-",
        warrantyDate: getWarrantyExpiresAt(d),
      }));
    }
    return [];
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

  const isOrderSectionOpen = activeSection === "order";
  const isWarrantySectionOpen = activeSection === "warranty";

  const getPageTitle = () => {
    if (isOrderSectionOpen) {
      const title = language === "zh-CN" ? "订单信息管理" : "Order Management";
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <FileTextOutlined aria-hidden />
          <span>{title}</span>
        </span>
      );
    }
    if (isWarrantySectionOpen) {
      const title = language === "zh-CN" ? "质保信息查询" : "Warranty Information";
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <SafetyCertificateOutlined aria-hidden />
          <span>{title}</span>
        </span>
      );
    }
    return messages.devices.title;
  };

  const getPageSubtitle = () => {
    if (isOrderSectionOpen) {
      return language === "zh-CN"
        ? "上传订单截图，绑定设备并激活质保服务。"
        : "Upload order screenshots to bind devices and activate warranty.";
    }
    if (isWarrantySectionOpen) {
      return language === "zh-CN"
        ? "查看已绑定订单的质保到期时间。"
        : "View warranty expiration dates for bound orders.";
    }
    return messages.devices.subtitle;
  };

  return (
    <div className="vben-page">
      <div className="vben-page__header">
        <h1 className="vben-page__title">{getPageTitle()}</h1>
        <p className="vben-page__subtitle">{getPageSubtitle()}</p>
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
        {isOrderSectionOpen && (
          <>
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
                <Text type="secondary">
                  {language === "zh-CN"
                    ? "上传订单截图以绑定设备信息"
                    : "Upload order screenshots to bind device information"}
                </Text>
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
                  items={orders[NO_DEVICE_ID] ?? []}
                  onDelete={handleDeleteOrder}
                  loading={loading}
                />
              </Card>
            </div>
          </>
        )}
      </section>

      {/* 质保信息区块：由左侧菜单/Hash 控制是否显示（避免与菜单重复） */}
      <section
        id="warranty-section"
        className="user-page-section"
        style={{ marginTop: 28 }}
      >
        {isWarrantySectionOpen && (
          <>
            <p className="user-page-section__subtext">{messages.devices.listSubtitle}</p>
            <Card style={{ width: "100%" }} styles={{ body: { paddingTop: 12 } }}>
              <Table
                dataSource={getWarrantyDataSource()}
                columns={warrantyColumns}
                pagination={false}
                tableLayout="fixed"
                locale={{
                  emptyText: <Empty description={messages.devices.emptyText} />,
                }}
              />
              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                <Pagination
                  current={page}
                  total={totalRowsForPaging}
                  pageSize={pageSize}
                  onChange={(p) => setPage(p)}
                  showSizeChanger={false}
                />
              </div>
            </Card>
          </>
        )}
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
