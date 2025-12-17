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
        borderTop: "1px dashed #e5e7eb",
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
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {items.map((o) => (
          <div
            key={o.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 6,
              width: 120,
              position: "relative",
            }}
          >
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(o)}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  border: "none",
                  background: "rgba(0,0,0,0.5)",
                  color: "#fff",
                  borderRadius: 9999,
                  padding: "0 6px",
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            )}
            <div
              style={{
                width: "100%",
                height: 80,
                overflow: "hidden",
                borderRadius: 4,
                marginBottom: 4,
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
            <div
              style={{
                fontSize: 10,
                color: "#6b7280",
                marginBottom: 2,
                lineHeight: 1.4,
              }}
            >
              <div>{new Date(o.createdAt).toLocaleDateString()}</div>
              {o.orderCreatedTime && (
                <div>
                  {language === "zh-CN"
                    ? `创建时间：${o.orderCreatedTime}`
                    : `Created: ${o.orderCreatedTime}`}
                </div>
              )}
              {o.orderPaidTime && (
                <div>
                  {language === "zh-CN"
                    ? `付款时间：${o.orderPaidTime}`
                    : `Paid: ${o.orderPaidTime}`}
                </div>
              )}
              {o.orderNo && (
                <div>
                  {language === "zh-CN"
                    ? `订单号：${o.orderNo}`
                    : `Order No: ${o.orderNo}`}
                </div>
              )}
            </div>
            {o.note && (
              <div
                style={{
                  fontSize: 10,
                  color: "#4b5563",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={o.note}
              >
                {o.note}
              </div>
            )}
          </div>
        ))}
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
  const [newDeviceId, setNewDeviceId] = useState("");
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

      <section className="user-page-section">
        <div className="user-page-section__header">
          <h2 className="user-page-section__title">
            {messages.devices.addSectionTitle}
          </h2>
          <p className="user-page-section__subtext">
            {messages.devices.addSectionDesc}
          </p>
        </div>
        <div className="user-page-card">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              placeholder={messages.devices.inputPlaceholder}
              value={newDeviceId}
              onChange={(e) => setNewDeviceId(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={async () => {
                if (!userEmail) return;
                const trimmed = newDeviceId.trim();
                if (!trimmed) {
                  setError(messages.devices.addEmptyError);
                  setOkMsg("");
                  return;
                }

                setError("");
                setOkMsg("");

                try {
                  const res = await fetch("/api/user/devices", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: userEmail,
                      deviceId: trimmed,
                    }),
                  });
                  if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || messages.devices.addFailed);
                  }
                  const created = (await res.json()) as Device;
                  // 如果当前在第 1 页，则直接把新设备插入到列表顶部，立即展示
                  setDevices((prev) => {
                    if (page !== 1) return prev;
                    const next = [created, ...prev];
                    return next.slice(0, pageSize);
                  });
                  setOkMsg(messages.devices.addSuccess);
                  setNewDeviceId("");
                  setTotal((prev) => prev + 1);
                  setPage(1);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : messages.devices.addFailed
                  );
                }
              }}
            >
              {messages.devices.addButton}
            </button>
          </div>
        </div>
      </section>

      {/* 未绑定设备的订单截图上传入口 */}
      <section className="user-page-section" style={{ marginTop: 24 }}>
        <div className="user-page-section__header">
          <h2 className="user-page-section__title">
            {language === "zh-CN"
              ? "上传订单截图（暂不绑定设备）"
              : "Upload order screenshot (no device yet)"}
          </h2>
          <p className="user-page-section__subtext">
            {language === "zh-CN"
              ? "如果你还没有设备 ID，也可以先上传订单或发票截图，管理员审核后再帮你绑定设备。"
              : "You can upload your order/invoice screenshot even without a device ID; admins can bind it later."}
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
      </section>

      {orders[NO_DEVICE_ID] && orders[NO_DEVICE_ID].length > 0 && (
        <section className="user-page-section" style={{ marginTop: 16 }}>
          <div className="user-page-section__header">
            <h2 className="user-page-section__title">
              {language === "zh-CN"
                ? "未绑定设备的订单截图"
                : "Order screenshots without device"}
            </h2>
            <p className="user-page-section__subtext">
              {language === "zh-CN"
                ? "这些截图当前尚未绑定到具体设备，管理员审核后会帮你完成关联。"
                : "These screenshots are not yet bound to a device; admins will review and bind them later."}
            </p>
          </div>
          <div className="user-page-card">
            <OrderThumbnailList
              items={orders[NO_DEVICE_ID]}
              language={language}
              onDelete={handleDeleteOrder}
            />
          </div>
        </section>
      )}

      <section className="user-page-section" style={{ marginTop: 28 }}>
        <div className="user-page-section__header">
          <h2 className="user-page-section__title">
            {messages.devices.listTitle}
          </h2>
          <p className="user-page-section__subtext">
            {messages.devices.listSubtitle}
          </p>
        </div>
        <div className="user-page-card">
          {devices.length === 0 ? (
            <p className="user-page-card__item-meta">
              {messages.devices.emptyText}
            </p>
          ) : (
            devices.map((d) => (
              <div key={d.id} className="user-device-card">
                <div className="user-device-card__row">
                  <div>
                    <div className="user-page-card__item-title">
                      {messages.devices.inputPlaceholder}：
                      <strong>{d.deviceId}</strong>
                    </div>
                    <div className="user-page-card__item-meta">
                      {messages.devices.warrantyLabel}
                      <strong>
                        {new Date(d.warrantyExpiresAt).toLocaleString()}
                      </strong>
                    </div>
                    <div
                      className="user-page-card__item-meta"
                      style={{ marginTop: 6 }}
                    >
                      <button
                        type="button"
                        style={{ fontSize: 12, padding: "2px 8px" }}
                        onClick={() => {
                          setUploadingOrderForDevice(d.deviceId);
                          setOrderFile(null);
                          setOrderNote("");
                          setError("");
                          setOkMsg("");
                        }}
                      >
                        {language === "zh-CN"
                          ? "上传订单截图"
                          : "Upload Order Screenshot"}
                      </button>
                    </div>
                    {orders[d.deviceId] && orders[d.deviceId].length > 0 && (
                      <OrderThumbnailList
                        items={orders[d.deviceId]}
                        language={language}
                        onDelete={handleDeleteOrder}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    className="user-device-card__remove"
                    onClick={async () => {
                      if (!userEmail) return;
                      const ok = window.confirm(
                        messages.devices.deleteConfirm(d.deviceId)
                      );
                      if (!ok) return;

                      setError("");
                      setOkMsg("");

                      try {
                        const res = await fetch("/api/user/devices", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            email: userEmail,
                            id: d.id,
                          }),
                        });
                        if (!res.ok) {
                          const text = await res.text();
                          throw new Error(text || messages.devices.deleteFailed);
                        }
                        setDevices((prev) => {
                          const next = prev.filter((item) => item.id !== d.id);
                          if (next.length === 0 && page > 1) {
                            setPage((p) => Math.max(1, p - 1));
                          }
                          return next;
                        });
                        setTotal((prev) => Math.max(0, prev - 1));
                        setOkMsg(messages.devices.deleteSuccess);
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : messages.devices.deleteFailed
                        );
                      }
                    }}
                  >
                    {messages.devices.deleteButton}
                  </button>
                </div>
              </div>
            ))
          )}
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
              onClick={() => hasPrev && setPage((p) => Math.max(1, p - 1))}
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
      </section>

      {uploadingOrderForDevice && (
        <section
          className="user-page-section"
          style={{ marginTop: 28, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}
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


