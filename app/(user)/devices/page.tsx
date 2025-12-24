"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getUserMessages } from "../../user-i18n";
import { useUser } from "../../contexts/UserContext";
import { useAutoDismissMessage } from "../../hooks/useAutoDismissMessage";

type Device = {
  id: number;
  deviceId: string;
  warrantyExpiresAt: string;
};

type OrderSnapshot = {
  id: number;
  deviceId: string;
  imageUrl: string;
  note: string | null;
  createdAt: string;
  // 解析出的订单号、创建时间、付款时间（如果有）
  orderNo?: string | null;
  orderCreatedTime?: string | null;
  orderPaidTime?: string | null;
  platform?: string | null;
  shopName?: string | null;
  deviceCount?: number | null;
};

// 与后端 `app/api/user/orders/route.ts` 中的 DEFAULT_DEVICE_ID 保持一致
const NO_DEVICE_ID = "__NO_DEVICE__";

function OrderThumbnailList({
  items,
  language,
  onDelete,
  onPreview,
}: {
  items: OrderSnapshot[];
  language: AppLanguage;
  onDelete?: (order: OrderSnapshot) => void;
  onPreview?: (imageUrl: string) => void;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 8,
        borderTop: "1px dashed #d1d5db",
        paddingTop: 8,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#6b7280",
          marginBottom: 4,
        }}
      >
        {language === "zh-CN"
          ? "已上传的订单截图："
          : "Uploaded order screenshots:"}
      </div>
      <div style={{ marginTop: 4, overflowX: "auto" }}>
        <div
          style={{
            minWidth: 820,
            border: "1px solid #d1d5db",
            borderRadius: 8,
          }}
        >
          {/* 表头行 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "6px 8px",
              borderBottom: "1px solid #d1d5db",
              fontSize: 11,
              background: "#f3f4f6",
              color: "#374151",
              fontWeight: 600,
            }}
          >
          <div
            style={{
              width: 80,
              flexShrink: 0,
              borderRight: "1px solid #d1d5db",
              textAlign: "center",
            }}
          >
              {language === "zh-CN" ? "截图" : "Screenshot"}
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 100,
                borderRight: "1px solid #d1d5db",
                textAlign: "center",
              }}
            >
              {language === "zh-CN" ? "店铺" : "Shop"}
            </div>
            <div
              style={{
                flex: 1.2,
                minWidth: 120,
                borderRight: "1px solid #d1d5db",
                textAlign: "center",
              }}
            >
              {language === "zh-CN" ? "订单号" : "Order No"}
            </div>
            <div
              style={{
                flex: 1.1,
                minWidth: 130,
                borderRight: "1px solid #d1d5db",
                textAlign: "center",
              }}
            >
              {language === "zh-CN" ? "创建时间" : "Created At"}
            </div>
            <div
              style={{
                flex: 1.1,
                minWidth: 130,
                borderRight: "1px solid #d1d5db",
                textAlign: "center",
              }}
            >
              {language === "zh-CN" ? "付款时间" : "Paid At"}
            </div>
            <div
              style={{
                width: 60,
                flexShrink: 0,
                borderRight: "1px solid #d1d5db",
                textAlign: "center",
              }}
            >
              {language === "zh-CN" ? "数量" : "Qty"}
            </div>
            <div
              style={{
                flex: 1.2,
                minWidth: 120,
                borderRight: "1px solid #d1d5db",
                textAlign: "center",
              }}
            >
              {language === "zh-CN" ? "备注" : "Note"}
            </div>
            <div
              style={{
                width: 70,
                flexShrink: 0,
                textAlign: "center",
                borderLeft: "1px solid #d1d5db",
              }}
            >
              {language === "zh-CN" ? "操作" : "Actions"}
            </div>
          </div>

          {/* 数据行 */}
          {items.map((o, idx) => (
            <div
              key={o.id}
              style={{
                display: "flex",
                alignItems: "stretch",
                padding: "6px 8px",
                borderTop: "1px solid #f3f4f6",
                fontSize: 11,
                color: "#4b5563",
                backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f9fafb",
              }}
            >
              {/* 截图 */}
              <div
                style={{
                  width: 80,
                  height: 56,
                  overflow: "hidden",
                  borderRadius: 4,
                  flexShrink: 0,
                  borderRight: "1px solid #d1d5db",
                }}
              >
                <button
                  type="button"
                  onClick={() => onPreview?.(o.imageUrl)}
                  style={{
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: "zoom-in",
                    display: "block",
                    width: "100%",
                    height: "100%",
                  }}
                  aria-label="预览订单截图"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={o.imageUrl}
                    alt="order"
                    width={80}
                    height={56}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </button>
              </div>

              {/* 店铺 */}
              <div
                style={{
                  flex: 1,
                  minWidth: 100,
                  display: "flex",
                  alignItems: "center",
                  borderRight: "1px solid #d1d5db",
                  justifyContent: "center",
                  textAlign: "center",
                }}
              >
                {o.shopName ?? "-"}
              </div>

              {/* 订单号 */}
              <div
                style={{
                  flex: 1.2,
                  minWidth: 120,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "flex",
                  alignItems: "center",
                  borderRight: "1px solid #d1d5db",
                  justifyContent: "center",
                  textAlign: "center",
                }}
                title={o.orderNo ?? undefined}
              >
                {o.orderNo ?? "-"}
              </div>

              {/* 创建时间 */}
              <div
                style={{
                  flex: 1.1,
                  minWidth: 130,
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  borderRight: "1px solid #d1d5db",
                  justifyContent: "center",
                  textAlign: "center",
                }}
              >
                {o.orderCreatedTime ??
                  new Date(o.createdAt).toLocaleString()}
              </div>

              {/* 付款时间 */}
              <div
                style={{
                  flex: 1.1,
                  minWidth: 130,
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  borderRight: "1px solid #d1d5db",
                  justifyContent: "center",
                  textAlign: "center",
                }}
              >
                {o.orderPaidTime ?? "-"}
              </div>

              {/* 数量 */}
              <div
                style={{
                  width: 60,
                  flexShrink: 0,
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRight: "1px solid #d1d5db",
                }}
              >
                {o.deviceCount != null ? String(o.deviceCount) : "-"}
              </div>

              {/* 备注 */}
              <div
                style={{
                  flex: 1.2,
                  minWidth: 120,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: "#6b7280",
                  borderRight: "1px solid #d1d5db",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                }}
                title={o.note ?? undefined}
              >
                {o.note ?? "-"}
              </div>

              {/* 操作 */}
              <div
                style={{
                  width: 70,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderLeft: "1px solid #d1d5db",
                }}
              >
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(o)}
                    style={{
                      borderRadius: 9999,
                      padding: "2px 10px",
                      fontSize: 10,
                      cursor: "pointer",
                      border: "1px solid #d1d5db",
                      background:
                        "linear-gradient(90deg, rgba(239,68,68,0.9), rgba(248,113,113,0.9))",
                      color: "#fff",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {language === "zh-CN" ? "移除" : "Remove"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function UserDevicesPage() {
  // 使用 UserContext 获取预加载的用户信息
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
  const [uploadingOrderForDevice, setUploadingOrderForDevice] =
    useState<string | null>(null);
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [orderNote, setOrderNote] = useState("");
  // 全局（未绑定设备）的订单截图上传
  const [globalOrderFile, setGlobalOrderFile] = useState<File | null>(null);
  const [globalOrderNote, setGlobalOrderNote] = useState("");
  const [uploadModalError, setUploadModalError] = useState("");
  const [orders, setOrders] = useState<Record<string, OrderSnapshot[]>>({});
  // 折叠菜单：订单信息 / 质保信息
  // 默认只展开第一个子菜单（订单信息），质保信息默认折叠
  const [isOrderSectionOpen, setIsOrderSectionOpen] = useState(true);
  const [isWarrantySectionOpen, setIsWarrantySectionOpen] = useState(false);
  // 图片预览弹窗
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // 上传订单截图弹窗
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const messages = getUserMessages(language);

  const closeUploadModal = () => {
    setGlobalOrderFile(null);
    setGlobalOrderNote("");
    setUploadModalError("");
    setIsUploadModalOpen(false);
  };

  // 根据地址栏 hash（#order-section / #warranty-section）控制右侧折叠菜单的展开状态，
  // 保证从其它页面跳转到设备信息页时自动展示正确的区域。
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromHash = () => {
      const hash = window.location.hash;
      if (hash === "#warranty-section") {
        setIsOrderSectionOpen(false);
        setIsWarrantySectionOpen(true);
      } else {
        // 默认：展示订单信息区块
        setIsOrderSectionOpen(true);
        setIsWarrantySectionOpen(false);
      }
    };

    syncFromHash();

    window.addEventListener("hashchange", syncFromHash);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, []);

  // 监听来自左侧菜单的“切换子菜单”事件，实时展开/收起对应区域
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ section: "order" | "warranty" }>;
      const section = custom.detail?.section;
      if (section === "order") {
        setIsOrderSectionOpen(true);
        setIsWarrantySectionOpen(false);
        if (window.location.hash !== "#order-section") {
          window.location.hash = "#order-section";
        }
      } else if (section === "warranty") {
        setIsOrderSectionOpen(false);
        setIsWarrantySectionOpen(true);
        if (window.location.hash !== "#warranty-section") {
          window.location.hash = "#warranty-section";
        }
      }
    };

    window.addEventListener("user-devices-section-changed", handler as EventListener);
    return () => {
      window.removeEventListener(
        "user-devices-section-changed",
        handler as EventListener
      );
    };
  }, []);

  // 根据某个设备的付款时间计算质保到期时间：付款日期 + 1.5 年。
  // 如果该设备还没有订单或付款时间不可用，则回退到设备自身的 warrantyExpiresAt 字段。
  const getWarrantyExpiresAt = (device: Device): Date => {
    const deviceOrders = orders[device.deviceId] ?? [];
    const paidDates: Date[] = [];

    for (const o of deviceOrders) {
      if (!o.orderPaidTime) continue;
      const raw = o.orderPaidTime.trim();
      if (!raw) continue;

      // 兼容 "YYYY-MM-DD HH:mm:ss" 格式，转为可被 Date 正确解析的字符串
      const normalized =
        raw.includes("T") || raw.endsWith("Z") ? raw : raw.replace(" ", "T");
      const d = new Date(normalized);
      if (!Number.isNaN(d.getTime())) {
        paidDates.push(d);
      }
    }

    if (paidDates.length > 0) {
      // 使用最早的付款时间作为质保起始
      let earliest = paidDates[0];
      for (const d of paidDates) {
        if (d.getTime() < earliest.getTime()) {
          earliest = d;
        }
      }
      const warranty = new Date(earliest);
      // 加 18 个月，相当于 1.5 年
      warranty.setMonth(warranty.getMonth() + 18);
      return warranty;
    }

    return new Date(device.warrantyExpiresAt);
  };

  // 根据订单本身的时间信息计算质保到期时间：优先使用付款时间，其次创建时间，最后回退到截图创建时间。
  const getWarrantyFromOrder = (o: OrderSnapshot): Date => {
    const raw =
      o.orderPaidTime?.trim() ||
      o.orderCreatedTime?.trim() ||
      o.createdAt?.trim();

    if (raw) {
      const normalized =
        raw.includes("T") || raw.endsWith("Z") ? raw : raw.replace(" ", "T");
      const base = new Date(normalized);
      if (!Number.isNaN(base.getTime())) {
        const warranty = new Date(base);
        // 加 18 个月，相当于 1.5 年
        warranty.setMonth(warranty.getMonth() + 18);
        return warranty;
      }
    }

    // 兜底：当前时间起算 18 个月
    const now = new Date();
    now.setMonth(now.getMonth() + 18);
    return now;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initialLang = getInitialLanguage();
    setLanguage(initialLang);

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ language: AppLanguage }>;
      if (custom.detail?.language) {
        setLanguage(custom.detail.language);
      }
    };

    window.addEventListener("app-language-changed", handler as EventListener);
    return () => {
      window.removeEventListener(
        "app-language-changed",
        handler as EventListener
      );
    };
  }, []);

  useEffect(() => {
    const loadDevices = async (email: string, pageNumber: number) => {
      setLoading(true);
      setError("");
      setOkMsg("");
      try {
        const res = await fetch(
          `/api/user/devices?email=${encodeURIComponent(
            email
          )}&page=${pageNumber}`
        );
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
        if (Array.isArray(data)) {
          // 兼容旧结构
          const list = data as Device[];
          setDevices(list);
          setDeviceTotal(list.length);
          setPage(1); // 旧结构无分页信息，回退到第 1 页
        } else {
          const obj = data as {
            items?: Device[];
            total?: number;
          };
          const items = obj.items ?? [];
          setDevices(items);
          setDeviceTotal(typeof obj.total === "number" ? obj.total : items.length);
        }
      } catch (e) {
        setError(
          e instanceof Error ? e.message : messages.devices.fetchFailed
        );
      } finally {
        setLoading(false);
      }
    };

    if (userEmail) {
      loadDevices(userEmail, page);
    }
  }, [userEmail, page, messages.devices.fetchFailed, setError, setOkMsg]);

  // ---- 订单汇总：用于“共 X 台设备”的展示（按订单号去重后汇总数量）----
  const getUniqueOrders = (): OrderSnapshot[] => {
    const map = new Map<string, OrderSnapshot>();
    Object.values(orders).forEach((list) => {
      list.forEach((o) => {
        const key = (o.orderNo || String(o.id)).trim();
        if (!map.has(key)) {
          map.set(key, o);
        }
      });
    });
    return Array.from(map.values());
  };

  const uniqueOrders = getUniqueOrders();
  const totalOrders = uniqueOrders.length;
  const totalDevicesFromOrders = uniqueOrders.reduce((sum, o) => {
    // 如果识别不到数量，默认按 1 计（至少买了 1 台）
    const n = typeof o.deviceCount === "number" && o.deviceCount > 0 ? o.deviceCount : 1;
    return sum + n;
  }, 0);

  const hasOrderData = totalOrders > 0;
  const totalDevicesForUi = hasOrderData ? totalDevicesFromOrders : deviceTotal;
  const totalRowsForPaging = hasOrderData ? totalOrders : deviceTotal;
  const maxPage = Math.max(1, Math.ceil(totalRowsForPaging / pageSize) || 1);
  const hasPrev = page > 1;
  const hasNext = page < maxPage;

  // 加载当前用户所有订单截图（按设备分组）
  useEffect(() => {
    const loadOrders = async (email: string) => {
      try {
        const res = await fetch(
          `/api/user/orders?email=${encodeURIComponent(email)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items: OrderSnapshot[] };
        const grouped: Record<string, OrderSnapshot[]> = {};
        for (const item of data.items) {
          if (!grouped[item.deviceId]) {
            grouped[item.deviceId] = [];
          }
          grouped[item.deviceId].push(item);
        }
        setOrders(grouped);
      } catch {
        // 忽略异常，不影响主流程
      }
    };

    if (userEmail) {
      loadOrders(userEmail);
    }
  }, [userEmail]);

  const handleDeleteOrder = async (order: OrderSnapshot) => {
    if (!userEmail) return;
    const confirmText =
      language === "zh-CN"
        ? "确定要删除这条订单截图吗？"
        : "Are you sure you want to delete this order screenshot?";
    const ok = window.confirm(confirmText);
    if (!ok) return;

    setError("");
    setOkMsg("");

    try {
      const res = await fetch("/api/user/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, id: order.id }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          text ||
            (language === "zh-CN"
              ? "删除订单截图失败"
              : "Failed to delete order screenshot")
        );
      }

      setOrders((prev) => {
        const key = order.deviceId || NO_DEVICE_ID;
        const list = prev[key] ?? [];
        const nextList = list.filter((item) => item.id !== order.id);
        const next: Record<string, OrderSnapshot[]> = { ...prev };
        if (nextList.length > 0) {
          next[key] = nextList;
        } else {
          delete next[key];
        }
        return next;
      });

      setOkMsg(
        language === "zh-CN"
          ? "订单截图已删除"
          : "Order screenshot deleted"
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : language === "zh-CN"
            ? "删除订单截图失败"
            : "Failed to delete order screenshot"
      );
    }
  };

  // maxPage/hasPrev/hasNext 已在上方基于「订单条目数/旧设备数」统一计算

  // 等待 UserContext 初始化完成再判断登录状态
  if (!isUserInitialized) {
    return (
      <div className="vben-page">
        <div className="vben-page__header">
          <h1 className="vben-page__title">{messages.devices.title}</h1>
        </div>
        <p>{messages.common.loading}</p>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="vben-page">
        <div className="vben-page__header">
          <h1 className="vben-page__title">{messages.devices.title}</h1>
        </div>
        <p>{messages.common.loginRequired}</p>
        <Link href="/login">{messages.common.goLogin}</Link>
      </div>
    );
  }

  // 根据当前展开的区块动态获取标题和描述
  const getPageTitle = () => {
    if (isOrderSectionOpen) {
      return language === "zh-CN" ? "订单信息管理" : "Order Management";
    }
    if (isWarrantySectionOpen) {
      return language === "zh-CN" ? "质保信息查询" : "Warranty Information";
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

      {loading && (
        <p style={{ marginTop: 16 }}>{messages.common.loading}</p>
      )}
      {error && (
        <p style={{ marginTop: 16, color: "red" }}>
          {error || messages.devices.fetchFailed}
        </p>
      )}
      {okMsg && (
        <p style={{ marginTop: 16, color: "green" }}>
          {okMsg}
        </p>
      )}

      {/* 订单信息：上传订单截图 + 未绑定设备的订单截图列表（标题由左侧菜单承担，这里不再单独展示） */}
      <section
        id="order-section"
        className="user-page-section"
        style={{ marginTop: 24 }}
      >
        {isOrderSectionOpen && (
          <>
            {/* 上传订单截图触发按钮 */}
            <div className="user-page-card">
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  padding: "20px 0",
                }}
              >
                <p
                  style={{
                    fontSize: 14,
                    color: "#9ca3af",
                    margin: 0,
                    textAlign: "center",
                  }}
                >
                  {language === "zh-CN"
                    ? "上传订单截图以绑定设备信息"
                    : "Upload order screenshots to bind device information"}
                </p>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="btn btn-primary btn-lg upload-modal-trigger-btn"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {language === "zh-CN" ? "上传订单截图" : "Upload Order Screenshot"}
                </button>
              </div>
            </div>

            {orders[NO_DEVICE_ID] && orders[NO_DEVICE_ID].length > 0 && (
              <div
                className="user-page-section"
                style={{ marginTop: 16, padding: 0 }}
              >
                <div className="user-page-card">
                  <OrderThumbnailList
                    items={orders[NO_DEVICE_ID]}
                    language={language}
                    onDelete={handleDeleteOrder}
                    onPreview={setPreviewUrl}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* 质保信息：我的订单列表（含质保期限），标题由左侧菜单承担，这里不再单独展示 */}
      <section
        id="warranty-section"
        className="user-page-section"
        style={{ marginTop: 28 }}
      >
        {isWarrantySectionOpen && (
          <>
            <p className="user-page-section__subtext">
              {messages.devices.listSubtitle}
            </p>
            <div className="user-page-card">
          {(() => {
            // 根据截图信息汇总订单列表（按订单号去重）
            const orderList = uniqueOrders;
            const start = (page - 1) * pageSize;
            const pagedOrders = orderList.slice(start, start + pageSize);

            if (orderList.length === 0 && devices.length === 0) {
              return (
                <p className="user-page-card__item-meta">
                  {messages.devices.emptyText}
                </p>
              );
            }

            // 如果没有截图订单，但有手工登记的订单（旧数据），继续展示原来的设备列表作为兜底。
            if (orderList.length === 0) {
              return devices.map((d) => (
                <div key={d.id} className="user-device-card">
                  <div className="user-device-card__row">
                    <div>
                      <div className="user-page-card__item-title">
                        {messages.devices.idLabel}
                        <strong>{d.deviceId}</strong>
                      </div>
                      <div className="user-page-card__item-meta">
                        {messages.devices.warrantyLabel}
                        <strong>
                          {getWarrantyExpiresAt(d).toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              ));
            }

            // 默认：根据截图信息生成“我的订单列表”
            // 增加一个从 1 开始的序号，便于用户直观查看第几条订单
            return pagedOrders.map((o, index) => (
              <div key={o.id} className="user-device-card">
                <div className="user-device-card__row">
                  <div>
                    <div className="user-page-card__item-meta">
                      {language === "zh-CN" ? "序号：" : "No. "}
                      <strong>{start + index + 1}</strong>
                    </div>
                    <div className="user-page-card__item-title">
                      {messages.devices.idLabel}
                      <strong>{o.orderNo ?? String(o.id)}</strong>
                    </div>
                    <div className="user-page-card__item-meta">
                      {messages.devices.warrantyLabel}
                      <strong>
                        {getWarrantyFromOrder(o).toLocaleString()}
                      </strong>
                    </div>
                    {o.shopName && (
                      <div className="user-page-card__item-meta">
                        {language === "zh-CN" ? "店铺：" : "Shop: "}
                        <strong>{o.shopName}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ));
          })()}
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 12,
                color: "#9ca3af",
              }}
            >
              <span>
                {messages.devices.pagerText(
                  totalDevicesForUi,
                  totalRowsForPaging,
                  Math.min(page, maxPage),
                  maxPage
                )}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={() =>
                    hasPrev && setPage((p) => Math.max(1, p - 1))
                  }
                  className="btn btn-secondary btn-xs"
                >
                  {language === "zh-CN" ? "上一页" : "Prev"}
                </button>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() =>
                    hasNext && setPage((p) => Math.min(maxPage, p + 1))
                  }
                  className="btn btn-secondary btn-xs"
                >
                  {language === "zh-CN" ? "下一页" : "Next"}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {uploadingOrderForDevice && (
        <section
          className="user-page-section"
style={{ marginTop: 28, borderTop: "1px solid #d1d5db", paddingTop: 16 }}
        >
          <div className="user-page-section__header">
            <h2 className="user-page-section__title">
              {language === "zh-CN"
                ? `为设备 ${uploadingOrderForDevice} 上传订单截图`
                : `Upload order screenshot for device ${uploadingOrderForDevice}`}
            </h2>
            <p className="user-page-section__subtext">
              {language === "zh-CN"
                ? "请上传清晰的订单或发票截图，便于管理员核对。"
                : "Please upload a clear screenshot of your order or invoice."}
            </p>
          </div>
          <div className="user-page-card">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <input
                  id={`device-order-file-${uploadingOrderForDevice}`}
                  type="file"
                  accept="image/*"
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0, 0, 0, 0)",
                    whiteSpace: "nowrap",
                    border: 0,
                  }}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setOrderFile(file);
                  }}
                />
                <label
                  htmlFor={`device-order-file-${uploadingOrderForDevice}`}
                  className="btn btn-secondary btn-sm"
                >
                  {language === "zh-CN"
                    ? "选择截图文件"
                    : "Choose screenshot file"}
                </label>
                <span
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                  }}
                >
                  {orderFile
                    ? orderFile.name
                    : language === "zh-CN"
                      ? "未选择文件"
                      : "No file selected"}
                </span>
              </div>
              <textarea
                placeholder={messages.devices.orderNotePlaceholder}
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                style={{ minHeight: 60, resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    if (!userEmail || !uploadingOrderForDevice) return;
                    if (!orderFile) {
                      setError(
                        language === "zh-CN"
                          ? "请选择要上传的截图文件"
                          : "Please choose a file to upload"
                      );
                      setOkMsg("");
                      return;
                    }
                    setLoading(true);
                    setError("");
                    setOkMsg("");
                    try {
                      const formData = new FormData();
                      formData.append("email", userEmail);
                      formData.append("deviceId", uploadingOrderForDevice);
                      formData.append("file", orderFile);
                      if (orderNote.trim()) {
                        formData.append("note", orderNote.trim());
                      }
                      const res = await fetch("/api/user/orders", {
                        method: "POST",
                        body: formData,
                      });
                      if (!res.ok) {
                        const text = await res.text();
                        throw new Error(
                          text ||
                            (language === "zh-CN"
                              ? "上传订单截图失败"
                              : "Failed to upload order screenshot")
                        );
                      }
                      const data = (await res.json()) as OrderSnapshot;
                      setOrders((prev) => {
                        const list = prev[uploadingOrderForDevice] ?? [];
                        return {
                          ...prev,
                          [uploadingOrderForDevice]: [data, ...list],
                        };
                      });
                      setOkMsg(
                        language === "zh-CN"
                          ? "订单截图上传成功"
                          : "Order screenshot uploaded"
                      );
                      setUploadingOrderForDevice(null);
                      setOrderFile(null);
                      setOrderNote("");
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : language === "zh-CN"
                            ? "上传订单截图失败"
                            : "Failed to upload order screenshot"
                      );
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="btn btn-primary btn-sm"
                >
                  {language === "zh-CN" ? "提交" : "Submit"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadingOrderForDevice(null);
                    setOrderFile(null);
                    setOrderNote("");
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  {language === "zh-CN" ? "取消" : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 图片预览弹窗 */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPreviewUrl(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "rgba(0, 0, 0, 0.8)",
            cursor: "zoom-out",
          }}
        >
          <button
            type="button"
            onClick={() => setPreviewUrl(null)}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
            }}
            className="btn btn-secondary btn-icon btn-lg"
            aria-label={language === "zh-CN" ? "关闭预览" : "Close preview"}
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="preview"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 4px 32px rgba(0, 0, 0, 0.5)",
              cursor: "default",
            }}
          />
        </div>
      )}

      {/* 上传订单截图弹窗 */}
      {isUploadModalOpen && (
        <div
          className="upload-modal-overlay"
          onClick={closeUploadModal}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeUploadModal();
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(4px)",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            className="upload-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "90%",
              maxWidth: 480,
              background: "var(--order-upload-modal-bg)",
              borderRadius: 16,
              border: "1px solid var(--order-upload-modal-border)",
              boxShadow: "var(--order-upload-modal-shadow)",
              animation: "slideUp 0.3s ease-out",
              overflow: "hidden",
            }}
          >
            {/* 弹窗头部 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 24px",
                borderBottom: "1px solid var(--order-upload-modal-header-border)",
                background: "var(--order-upload-modal-header-bg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 600,
                      color: "var(--order-upload-modal-title)",
                    }}
                  >
                    {language === "zh-CN" ? "上传订单截图" : "Upload Order Screenshot"}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--order-upload-modal-subtitle)",
                    }}
                  >
                    {language === "zh-CN"
                      ? "请上传清晰的订单截图"
                      : "Please upload a clear order screenshot"}
                  </p>
                </div>
              </div>
            </div>

            {/* 弹窗内容 */}
            <div style={{ padding: 24 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {/* 文件选择区域 */}
                <div
                  style={{
                    border: "2px dashed var(--order-upload-modal-drop-border)",
                    borderRadius: 12,
                    padding: 24,
                    textAlign: "center",
                    background: "var(--order-upload-modal-drop-bg)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <input
                    id="modal-order-file"
                    type="file"
                    accept="image/*"
                    style={{
                      position: "absolute",
                      width: 1,
                      height: 1,
                      padding: 0,
                      margin: -1,
                      overflow: "hidden",
                      clip: "rect(0, 0, 0, 0)",
                      whiteSpace: "nowrap",
                      border: 0,
                    }}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setGlobalOrderFile(file);
                      setUploadModalError("");
                    }}
                  />
                  <label
                    htmlFor="modal-order-file"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        background: globalOrderFile
                          ? "linear-gradient(135deg, #22c55e, #16a34a)"
                          : "rgba(59, 130, 246, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {globalOrderFile ? (
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          fontWeight: 500,
                          color: globalOrderFile
                            ? "#22c55e"
                            : "var(--order-upload-modal-file-title)",
                        }}
                      >
                        {globalOrderFile
                          ? globalOrderFile.name
                          : language === "zh-CN"
                            ? "点击选择截图文件"
                            : "Click to select screenshot"}
                      </p>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 12,
                          color: "var(--order-upload-modal-file-muted)",
                        }}
                      >
                        {language === "zh-CN"
                          ? "支持 JPG、PNG、GIF 格式"
                          : "Supports JPG, PNG, GIF formats"}
                      </p>
                    </div>
                  </label>
                </div>

                {/* 弹窗内错误提示（上传失败/校验失败） */}
                {uploadModalError && (
                  <div
                    role="alert"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--order-upload-modal-error-border)",
                      background: "var(--order-upload-modal-error-bg)",
                      color: "var(--order-upload-modal-error-fg)",
                      fontSize: 13,
                      lineHeight: 1.4,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {uploadModalError}
                  </div>
                )}

                {/* 备注输入 */}
                <div>
                  <label
                    htmlFor="modal-order-note"
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--order-upload-modal-note-label)",
                      marginBottom: 8,
                    }}
                  >
                    {language === "zh-CN" ? "备注（可选）" : "Note (optional)"}
                  </label>
                  <textarea
                    id="modal-order-note"
                    placeholder={messages.devices.orderNotePlaceholder}
                    value={globalOrderNote}
                    onChange={(e) => setGlobalOrderNote(e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: 80,
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid var(--order-upload-modal-textarea-border)",
                      background: "var(--order-upload-modal-textarea-bg)",
                      color: "var(--order-upload-modal-textarea-fg)",
                      fontSize: 14,
                      resize: "vertical",
                      outline: "none",
                      transition: "border-color 0.2s ease",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 弹窗底部按钮 */}
            <div
              style={{
                display: "flex",
                gap: 12,
                padding: "16px 24px 24px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  closeUploadModal();
                }}
                className="btn btn-secondary btn-lg"
              >
                {language === "zh-CN" ? "取消" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={loading}
                className="btn btn-primary btn-lg"
                onClick={async () => {
                  if (!userEmail) return;
                  if (!globalOrderFile) {
                    setUploadModalError(
                      language === "zh-CN"
                        ? "请选择要上传的截图文件"
                        : "Please choose a file to upload"
                    );
                    return;
                  }
                  setLoading(true);
                  setUploadModalError("");
                  try {
                    const formData = new FormData();
                    formData.append("email", userEmail);
                    formData.append("file", globalOrderFile);
                    if (globalOrderNote.trim()) {
                      formData.append("note", globalOrderNote.trim());
                    }
                    const res = await fetch("/api/user/orders", {
                      method: "POST",
                      body: formData,
                    });
                    if (!res.ok) {
                      const text = await res.text();
                      throw new Error(
                        text ||
                          (language === "zh-CN"
                            ? "上传订单截图失败"
                            : "Failed to upload order screenshot")
                      );
                    }
                    const data = (await res.json()) as OrderSnapshot;
                    setOrders((prev) => {
                      const key = data.deviceId || NO_DEVICE_ID;
                      const list = prev[key] ?? [];
                      return {
                        ...prev,
                        [key]: [data, ...list],
                      };
                    });
                    setOkMsg(
                      language === "zh-CN"
                        ? "订单截图上传成功"
                        : "Order screenshot uploaded"
                    );
                    closeUploadModal();
                  } catch (e) {
                    const baseMsg =
                      e instanceof Error
                        ? e.message
                        : language === "zh-CN"
                          ? "上传订单截图失败"
                          : "Failed to upload order screenshot";
                    const hint =
                      language === "zh-CN"
                        ? "请重新选择截图并再次提交。"
                        : "Please re-select the screenshot and submit again.";
                    setUploadModalError(
                      baseMsg.includes(hint) ? baseMsg : `${baseMsg}\n${hint}`
                    );
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {loading && (
                  <svg
                    className="animate-spin"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
                  </svg>
                )}
                {language === "zh-CN" ? "提交" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


