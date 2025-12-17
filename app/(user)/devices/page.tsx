"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getUserMessages } from "../../user-i18n";

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
}: {
  items: OrderSnapshot[];
  language: AppLanguage;
  onDelete?: (order: OrderSnapshot) => void;
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
                <a href={o.imageUrl} target="_blank" rel="noreferrer">
                  <img
                    src={o.imageUrl}
                    alt="order"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </a>
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
  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 5;
  const [uploadingOrderForDevice, setUploadingOrderForDevice] =
    useState<string | null>(null);
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [orderNote, setOrderNote] = useState("");
  // 全局（未绑定设备）的订单截图上传
  const [globalOrderFile, setGlobalOrderFile] = useState<File | null>(null);
  const [globalOrderNote, setGlobalOrderNote] = useState("");
  const [orders, setOrders] = useState<Record<string, OrderSnapshot[]>>({});
  // 折叠菜单：订单信息 / 质保信息
  const [isOrderSectionOpen, setIsOrderSectionOpen] = useState(true);
  const [isWarrantySectionOpen, setIsWarrantySectionOpen] = useState(true);

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
    if (typeof window !== "undefined") {
      const email = window.localStorage.getItem("loggedInUserEmail");
      if (email) {
        setUserEmail(email);
      }
    }
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
            setTotal(0);
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
          setTotal(list.length);
          setPage(1);
        } else {
          const obj = data as {
            items?: Device[];
            total?: number;
          };
          const items = obj.items ?? [];
          setDevices(items);
          setTotal(typeof obj.total === "number" ? obj.total : items.length);
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
  }, [userEmail, page]);

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

  const messages = getUserMessages(language);

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

  const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1);
  const hasPrev = page > 1;
  const hasNext = page < maxPage;

  if (!userEmail) {
    return (
      <div style={{ maxWidth: 640, margin: "10px auto" }}>
        <h1>{messages.devices.title}</h1>
        <p>{messages.common.loginRequired}</p>
        <Link href="/login">{messages.common.goLogin}</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "10px auto" }}>
      <h1>{messages.devices.title}</h1>
      <p style={{ marginTop: 8, fontSize: 14, color: "#9ca3af" }}>
        {messages.devices.subtitle}
      </p>

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

      {/* 订单信息（折叠菜单）：上传订单截图 + 未绑定设备的订单截图列表 */}
      <section
        id="order-section"
        className="user-page-section"
        style={{ marginTop: 24 }}
      >
        <div
          className="user-page-section__header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
          }}
          onClick={() => setIsOrderSectionOpen((v) => !v)}
        >
          <h2 className="user-page-section__title">
            {language === "zh-CN" ? "订单信息" : "Order information"}
          </h2>
          <button
            type="button"
            aria-label={
              language === "zh-CN"
                ? isOrderSectionOpen
                  ? "收起订单信息"
                  : "展开订单信息"
                : isOrderSectionOpen
                  ? "Collapse order section"
                  : "Expand order section"
            }
            onClick={(e) => {
              e.stopPropagation();
              setIsOrderSectionOpen((v) => !v);
            }}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            {isOrderSectionOpen ? "▾" : "▸"}
          </button>
        </div>

        {isOrderSectionOpen && (
          <>
            {/* 未绑定设备的订单截图上传入口 */}
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
                    id="global-order-file"
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
                    }}
                  />
                  <label
                    htmlFor="global-order-file"
                    style={{
                      padding: "6px 12px",
                      borderRadius: 9999,
                      background:
                        "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(37,99,235,0.9))",
                      color: "#fff",
                      fontSize: 13,
                      cursor: "pointer",
                      border: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
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
                    {globalOrderFile
                      ? globalOrderFile.name
                      : language === "zh-CN"
                        ? "未选择文件"
                        : "No file selected"}
                  </span>
                </div>
                <textarea
                  placeholder={messages.devices.orderNotePlaceholder}
                  value={globalOrderNote}
                  onChange={(e) => setGlobalOrderNote(e.target.value)}
                  style={{ minHeight: 60, resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!userEmail) return;
                      if (!globalOrderFile) {
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
                        setGlobalOrderFile(null);
                        setGlobalOrderNote("");
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
                  >
                    {language === "zh-CN" ? "提交" : "Submit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalOrderFile(null);
                      setGlobalOrderNote("");
                    }}
                    style={{ opacity: 0.8 }}
                  >
                    {language === "zh-CN" ? "清空" : "Reset"}
                  </button>
                </div>
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
                  />
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* 质保信息（折叠菜单）：我的订单列表（含质保期限） */}
      <section
        id="warranty-section"
        className="user-page-section"
        style={{ marginTop: 28 }}
      >
        <div
          className="user-page-section__header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
          }}
          onClick={() => setIsWarrantySectionOpen((v) => !v)}
        >
          <h2 className="user-page-section__title">
            {language === "zh-CN" ? "质保信息" : "Warranty information"}
          </h2>
          <button
            type="button"
            aria-label={
              language === "zh-CN"
                ? isWarrantySectionOpen
                  ? "收起质保信息"
                  : "展开质保信息"
                : isWarrantySectionOpen
                  ? "Collapse warranty section"
                  : "Expand warranty section"
            }
            onClick={(e) => {
              e.stopPropagation();
              setIsWarrantySectionOpen((v) => !v);
            }}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            {isWarrantySectionOpen ? "▾" : "▸"}
          </button>
        </div>

        {isWarrantySectionOpen && (
          <>
            <p className="user-page-section__subtext">
              {messages.devices.listSubtitle}
            </p>
            <div className="user-page-card">
          {(() => {
            // 根据截图信息汇总订单列表（按订单号去重）
            const map = new Map<string, OrderSnapshot>();
            Object.values(orders).forEach((list) => {
              list.forEach((o) => {
                const key = (o.orderNo || String(o.id)).trim();
                if (!map.has(key)) {
                  map.set(key, o);
                }
              });
            });
            const orderList = Array.from(map.values());

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
            return orderList.map((o, index) => (
              <div key={o.id} className="user-device-card">
                <div className="user-device-card__row">
                  <div>
                    <div className="user-page-card__item-meta">
                      {language === "zh-CN" ? "序号：" : "No. "}
                      <strong>{index + 1}</strong>
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
                  total,
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
                  style={{
                    padding: "4px 10px",
                    borderRadius: 9999,
                    fontSize: 12,
                    opacity: hasPrev ? 1 : 0.5,
                  }}
                >
                  {language === "zh-CN" ? "上一页" : "Prev"}
                </button>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() =>
                    hasNext && setPage((p) => Math.min(maxPage, p + 1))
                  }
                  style={{
                    padding: "4px 10px",
                    borderRadius: 9999,
                    fontSize: 12,
                    opacity: hasNext ? 1 : 0.5,
                  }}
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
                  style={{
                    padding: "6px 12px",
                    borderRadius: 9999,
                    background:
                      "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(37,99,235,0.9))",
                    color: "#fff",
                    fontSize: 13,
                    cursor: "pointer",
                    border: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
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
                  style={{ opacity: 0.8 }}
                >
                  {language === "zh-CN" ? "取消" : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}


