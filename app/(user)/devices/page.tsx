"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Typography, 
  Button, 
  Card, 
  Tabs, 
  Space, 
  Alert, 
  Spin, 
  Empty, 
  Pagination, 
  Table, 
  Tag 
} from "antd";
import { CloudUploadOutlined, SafetyCertificateOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import type { TabsProps, TableProps } from "antd";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getUserMessages } from "../../user-i18n";
import { useUser } from "../../contexts/UserContext";
import { useAutoDismissMessage } from "../../hooks/useAutoDismissMessage";
import UserOrdersList, { OrderSnapshot } from "../../components/UserOrdersList";
import OrderUploadModal from "../../components/OrderUploadModal";

const { Title, Text, Paragraph } = Typography;

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
  
  // Tab state synced with hash
  const [activeTab, setActiveTab] = useState<string>("order");
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const messages = getUserMessages(language);

  // Sync Tabs with Hash and Event
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromHash = () => {
      const hash = window.location.hash;
      if (hash === "#warranty-section") {
        setActiveTab("warranty");
      } else {
        setActiveTab("order");
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ section: "order" | "warranty" }>;
      const section = custom.detail?.section;
      if (section === "order") {
        setActiveTab("order");
        if (window.location.hash !== "#order-section") window.location.hash = "#order-section";
      } else if (section === "warranty") {
        setActiveTab("warranty");
        if (window.location.hash !== "#warranty-section") window.location.hash = "#warranty-section";
      }
    };

    window.addEventListener("user-devices-section-changed", handler as EventListener);

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("user-devices-section-changed", handler as EventListener);
    };
  }, []);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    window.location.hash = key === "warranty" ? "#warranty-section" : "#order-section";
  };

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
    const loadDevices = async (email: string, pageNumber: number) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/user/devices?email=${encodeURIComponent(email)}&page=${pageNumber}`);
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

    if (userEmail) loadDevices(userEmail, page);
  }, [messages.devices.fetchFailed, page, setError, userEmail]);

  useEffect(() => {
    const loadOrders = async (email: string) => {
      try {
        const res = await fetch(`/api/user/orders?email=${encodeURIComponent(email)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { items: OrderSnapshot[] };
        const grouped: Record<string, OrderSnapshot[]> = {};
        for (const item of data.items) {
          if (!grouped[item.deviceId]) grouped[item.deviceId] = [];
          grouped[item.deviceId].push(item);
        }
        setOrders(grouped);
      } catch {}
    };
    if (userEmail) loadOrders(userEmail);
  }, [userEmail]);

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

  // Delete Order Logic
  const handleDeleteOrder = async (order: OrderSnapshot) => {
    if (!userEmail) return;
    try {
      const res = await fetch("/api/user/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, id: order.id }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || (language === "zh-CN" ? "删除失败" : "Delete failed"));
      }

      setOrders((prev) => {
        const key = order.deviceId || NO_DEVICE_ID;
        const list = prev[key] ?? [];
        const nextList = list.filter((item) => item.id !== order.id);
        const next = { ...prev };
        if (nextList.length > 0) next[key] = nextList;
        else delete next[key];
        return next;
      });
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
    setOrders((prev) => {
      const key = data.deviceId || NO_DEVICE_ID;
      const list = prev[key] ?? [];
      return { ...prev, [key]: [data, ...list] };
    });
    setUploadingOrderForDevice(null);
  };

  if (!isUserInitialized) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Spin size="large" tip={messages.common.loading} />
      </div>
    );
  }

  if (!userEmail) {
    return (
      <Card style={{ margin: 24, textAlign: "center" }}>
         <Title level={4}>{messages.common.loginRequired}</Title>
         <Link href="/login"><Button type="primary">{messages.common.goLogin}</Button></Link>
      </Card>
    );
  }

  const items: TabsProps['items'] = [
    {
      key: 'order',
      label: (
        <Space>
          <ShoppingCartOutlined />
          {language === "zh-CN" ? "订单管理" : "Order Management"}
        </Space>
      ),
      children: (
        <div style={{ minHeight: 400 }}>
             <Card 
                style={{ marginBottom: 24, textAlign: "center" }}
                styles={{ body: { padding: 32 } }}
             >
                <Title level={4} style={{ marginBottom: 8 }}>
                    {language === "zh-CN" ? "上传订单截图" : "Upload Order Screenshot"}
                </Title>
                <Paragraph type="secondary" style={{ marginBottom: 24 }}>
                    {language === "zh-CN" ? "上传订单截图以绑定设备信息" : "Upload order screenshots to bind device information"}
                </Paragraph>
                <Button 
                    type="primary" 
                    icon={<CloudUploadOutlined />} 
                    size="large"
                    onClick={() => {
                        setUploadingOrderForDevice(null); // Global upload
                        setIsUploadModalOpen(true);
                    }}
                >
                    {language === "zh-CN" ? "立即上传" : "Upload Now"}
                </Button>
             </Card>

             <Card 
                title={language === "zh-CN" ? "已上传订单" : "Uploaded Orders"} 
                bordered={false}
             >
                <UserOrdersList 
                    language={language}
                    items={orders[NO_DEVICE_ID] ?? []}
                    onDelete={handleDeleteOrder}
                    loading={loading}
                />
             </Card>
        </div>
      ),
    },
    {
      key: 'warranty',
      label: (
        <Space>
          <SafetyCertificateOutlined />
          {language === "zh-CN" ? "质保查询" : "Warranty Check"}
        </Space>
      ),
      children: (
         <Card title={language === "zh-CN" ? "质保信息列表" : "Warranty List"}>
            <Alert 
                message={messages.devices.listSubtitle} 
                type="info" 
                showIcon 
                style={{ marginBottom: 16 }} 
            />
            <Table
                dataSource={getWarrantyDataSource()}
                columns={warrantyColumns}
                pagination={false}
                locale={{
                    emptyText: <Empty description={messages.devices.emptyText} />
                }}
            />
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                 <Pagination
                    current={page}
                    total={totalRowsForPaging}
                    pageSize={pageSize}
                    onChange={(p) => setPage(p)}
                    showSizeChanger={false}
                 />
            </div>
         </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
             <Title level={2}>{messages.devices.title}</Title>
             <Text type="secondary">{messages.devices.subtitle}</Text>
        </div>

        {error && <Alert type="error" message={error} showIcon closable />}
        {okMsg && <Alert type="success" message={okMsg} showIcon closable />}

        <Tabs 
            activeKey={activeTab} 
            onChange={handleTabChange} 
            items={items} 
            type="card"
            size="large"
        />
      </Space>

      <OrderUploadModal 
        open={isUploadModalOpen}
        onClose={() => {
            setIsUploadModalOpen(false);
            setUploadingOrderForDevice(null);
        }}
        onSuccess={handleUploadSuccess}
        email={userEmail}
        deviceId={uploadingOrderForDevice}
        language={language}
      />
    </div>
  );
}
