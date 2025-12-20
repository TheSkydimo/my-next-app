"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AppLanguage } from "../../../client-prefs";
import { getInitialLanguage } from "../../../client-prefs";
import { getAdminMessages } from "../../../admin-i18n";
import { useAdmin } from "../../../contexts/AdminContext";

type UserDetail = {
  username: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  isVip: boolean;
  vipExpiresAt: string | null;
  createdAt: string;
};

type AdminOrderItem = {
  id: number;
  userEmail: string;
  deviceId: string;
  imageUrl: string;
  note: string | null;
  createdAt: string;
  orderNo?: string | null;
  orderCreatedTime?: string | null;
  orderPaidTime?: string | null;
};

type SegmentParams = {
  [key: string]: string | string[] | undefined;
};

type AdminUserDetailPageProps = {
  params?: Promise<SegmentParams>;
};

export default function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
  // 使用 AdminContext 获取预加载的管理员信息
  const adminContext = useAdmin();
  const adminEmail = adminContext.profile?.email ?? null;

  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [user, setUser] = useState<UserDetail | null>(null);
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});

  const messages = getAdminMessages(language);

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
    let cancelled = false;

    const resolveParams = async () => {
      if (!params) return;
      const raw = await params;
      const rawEmailValue = raw.email;
      const emailValue = Array.isArray(rawEmailValue)
        ? rawEmailValue[0] ?? ""
        : rawEmailValue ?? "";

      if (!emailValue || cancelled) {
        return;
      }

      const decoded = decodeURIComponent(emailValue);
      if (!cancelled) {
        setUserEmail(decoded);
      }
    };

    void resolveParams();

    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!adminEmail || !userEmail) return;

    const controller = new AbortController();
    let active = true;

    const loadData = async () => {
      setLoading(true);
      setError("");
      setUser(null);
      setOrders([]);
      try {
        // 获取用户基础信息（精确查询，避免复用列表接口造成 LIMIT/模糊匹配问题）
        const userRes = await fetch(
          `/api/admin/users/${encodeURIComponent(userEmail)}`,
          { signal: controller.signal }
        );
        if (!userRes.ok) {
          const text = await userRes.text();
          throw new Error(text || messages.users.fetchFailed);
        }
        const userData = (await userRes.json()) as { user: UserDetail };
        if (!active) return;
        setUser(userData.user);

        // 获取该用户的订单截图（通过 /api/admin/orders 接口按邮箱过滤）
        const orderParams = new URLSearchParams({
          userEmail: userEmail,
        });
        const ordersRes = await fetch(
          `/api/admin/orders?${orderParams.toString()}`,
          { signal: controller.signal }
        );
        if (!ordersRes.ok) {
          const text = await ordersRes.text();
          throw new Error(text || messages.orders.fetchFailed);
        }
        const ordersData = (await ordersRes.json()) as {
          items: AdminOrderItem[];
        };
        if (!active) return;
        setOrders(ordersData.items);
      } catch (e) {
        // Ignore aborted requests to prevent stale errors.
        if ((e as { name?: string } | null)?.name === "AbortError") return;
        if (!active) return;
        setError(e instanceof Error ? e.message : messages.common.unknownError);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    void loadData();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    adminEmail,
    language,
    messages.common.unknownError,
    messages.orders.fetchFailed,
    messages.users.fetchFailed,
    userEmail,
  ]);

  if (!adminEmail) {
    return (
      <div className="vben-page">
        <div className="vben-page__header">
          <h1 className="vben-page__title">{messages.users.title}</h1>
        </div>
        <p>{messages.common.adminLoginRequired}</p>
        <Link href="/admin/login">{messages.common.goAdminLogin}</Link>
      </div>
    );
  }

  return (
    <div className="vben-page">
      <div className="vben-page__header">
        <div className="vben-row vben-row--between vben-row--center">
          <div>
            <h1 className="vben-page__title">
              {language === "zh-CN" ? "用户详情" : "User Detail"} -{" "}
              {user?.username || userEmail}
            </h1>
            <p className="vben-page__subtitle">{userEmail}</p>
          </div>
          <Link href="/admin/users" className="btn btn-secondary btn-sm">
            {language === "zh-CN" ? "返回用户列表" : "Back to users"}
          </Link>
        </div>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading && <p>{messages.common.loading}</p>}

      {user && (
        <section className="vben-card vben-card--simple" style={{ marginBottom: 16 }}>
          <div className="vben-card__header">
            <h2 className="vben-card__title">
              {language === "zh-CN" ? "基础信息" : "Basic Info"}
            </h2>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "9999px",
                  overflow: "hidden",
                  border: "1px solid rgba(148, 163, 184, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(15, 23, 42, 0.35)",
                  color: "#e2e8f0",
                  fontWeight: 600,
                }}
                title={user.username || user.email}
              >
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt="avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span>
                    {(user.username || user.email || "U")
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>
                  {user.username}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{user.email}</div>
              </div>
            </div>
            <div>
              <strong>
                {language === "zh-CN" ? "用户名：" : "Username: "}
              </strong>
              {user.username}
            </div>
            <div>
              <strong>{language === "zh-CN" ? "邮箱：" : "Email: "}</strong>
              {user.email}
            </div>
            <div>
              <strong>{language === "zh-CN" ? "角色：" : "Role: "}</strong>
              {user.isAdmin
                ? messages.users.roleAdmin
                : messages.users.roleUser}
            </div>
            <div>
              <strong>
                {language === "zh-CN" ? "会员状态：" : "VIP status: "}
              </strong>
              {user.isVip ? messages.users.vipOn : messages.users.vipOff}
              {user.vipExpiresAt && (
                <span style={{ marginLeft: 8, color: "#9ca3af", fontSize: 12 }}>
                  {new Date(user.vipExpiresAt).toLocaleString()}
                </span>
              )}
            </div>
            <div>
              <strong>
                {language === "zh-CN" ? "注册时间：" : "Created at: "}
              </strong>
              {user.createdAt}
            </div>
          </div>
        </section>
      )}

      <section className="vben-card vben-card--simple">
        <div className="vben-card__header">
          <h2 className="vben-card__title">{messages.orders.title}</h2>
        </div>
        {orders.length === 0 ? (
          <p style={{ fontSize: 14, color: "#9ca3af" }}>
            {messages.orders.emptyText}
          </p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
                    padding: 10,
                    textAlign: "center",
                  }}
                >
                  {messages.orders.tableIndex}
                </th>
                <th
                  style={{
                    borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
                    padding: 10,
                  }}
                >
                  {messages.orders.tableDeviceId}
                </th>
                <th
                  style={{
                    borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
                    padding: 10,
                  }}
                >
                  {messages.orders.tableImage}
                </th>
                <th
                  style={{
                    borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
                    padding: 10,
                  }}
                >
                  {messages.orders.tableNote}
                </th>
                <th
                  style={{
                    borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
                    padding: 10,
                  }}
                >
                  {messages.orders.tableCreatedAt}
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, index) => (
                <tr key={o.id}>
                  <td
                    style={{
                      borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
                      padding: 10,
                      textAlign: "center",
                    }}
                  >
                    {index + 1}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
                      padding: 10,
                      fontSize: 12,
                      color: "#cbd5e1",
                    }}
                  >
                    {o.deviceId}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
                      padding: 10,
                    }}
                  >
                    {brokenImages[o.id] ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>
                          {language === "zh-CN"
                            ? "截图无法预览（可能是不支持的格式，如 HEIC）"
                            : "Preview unavailable (possibly an unsupported format such as HEIC)"}
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <a
                            href={o.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#60a5fa", textDecoration: "underline", fontSize: 12 }}
                          >
                            {language === "zh-CN" ? "打开截图" : "Open"}
                          </a>
                          <a
                            href={o.imageUrl}
                            download
                            style={{ color: "#a78bfa", textDecoration: "underline", fontSize: 12 }}
                          >
                            {language === "zh-CN" ? "下载" : "Download"}
                          </a>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPreviewUrl(o.imageUrl)}
                        style={{
                          padding: 0,
                          border: "none",
                          background: "transparent",
                          cursor: "zoom-in",
                        }}
                        aria-label={
                          language === "zh-CN" ? "预览订单截图" : "Preview order image"
                        }
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={o.imageUrl}
                          alt="order"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [o.id]: true }))
                          }
                          style={{
                            width: 84,
                            height: 84,
                            objectFit: "cover",
                            borderRadius: 10,
                            border: "1px solid rgba(148, 163, 184, 0.25)",
                            background: "rgba(15, 23, 42, 0.35)",
                          }}
                        />
                      </button>
                    )}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
                      padding: 10,
                      fontSize: 12,
                      color: "#cbd5e1",
                      maxWidth: 200,
                    }}
                  >
                    {o.note || "-"}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
                      padding: 10,
                      fontSize: 12,
                      color: "#9ca3af",
                      lineHeight: 1.5,
                    }}
                  >
                    <div>{new Date(o.createdAt).toLocaleString()}</div>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              backgroundColor: "#111827",
              padding: 12,
              borderRadius: 8,
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            }}
          >
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              style={{
                display: "block",
                marginLeft: "auto",
                marginBottom: 8,
                background: "transparent",
                border: "none",
                color: "#e5e7eb",
                fontSize: 20,
                cursor: "pointer",
              }}
              aria-label="关闭预览"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="order-preview"
              style={{
                maxWidth: "100%",
                maxHeight: "80vh",
                objectFit: "contain",
                borderRadius: 6,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}


