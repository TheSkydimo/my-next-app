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
    const loadData = async (admin: string) => {
      setLoading(true);
      setError("");
      try {
        // 获取用户基础信息（复用 /api/admin/users 搜索接口）
        const userParams = new URLSearchParams({
          adminEmail: admin,
          page: "1",
          pageSize: "1",
          q: userEmail,
        });
        const userRes = await fetch(`/api/admin/users?${userParams.toString()}`);
        if (!userRes.ok) {
          const text = await userRes.text();
          throw new Error(text || messages.users.fetchFailed);
        }
        const userData = (await userRes.json()) as {
          users: UserDetail[];
        };
        const found = userData.users.find((u) => u.email === userEmail) ?? null;
        if (!found) {
          throw new Error(
            language === "zh-CN"
              ? "未找到该用户"
              : "User not found"
          );
        }
        setUser(found);

        // 获取该用户的订单截图（通过 /api/admin/orders 接口按邮箱过滤）
        const orderParams = new URLSearchParams({
          adminEmail: admin,
          userEmail: userEmail,
        });
        const ordersRes = await fetch(
          `/api/admin/orders?${orderParams.toString()}`
        );
        if (!ordersRes.ok) {
          const text = await ordersRes.text();
          throw new Error(text || messages.orders.fetchFailed);
        }
        const ordersData = (await ordersRes.json()) as {
          items: AdminOrderItem[];
        };
        setOrders(ordersData.items);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : messages.common.unknownError
        );
      } finally {
        setLoading(false);
      }
    };

    if (adminEmail) {
      loadData(adminEmail);
    }
  }, [adminEmail, language, messages.common.unknownError, messages.orders.fetchFailed, messages.users.fetchFailed, userEmail]);

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
        <section
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            backgroundColor: "#f9fafb",
          }}
        >
          <h2 style={{ marginBottom: 8, fontSize: 16 }}>
            {language === "zh-CN" ? "基础信息" : "Basic Info"}
          </h2>
          <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.8 }}>
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
                <span style={{ marginLeft: 8, color: "#6b7280", fontSize: 12 }}>
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

      <section>
        <h2 style={{ marginBottom: 8, fontSize: 16 }}>
          {messages.orders.title}
        </h2>
        {orders.length === 0 ? (
          <p style={{ fontSize: 14, color: "#6b7280" }}>
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
                <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                  {messages.orders.tableIndex}
                </th>
                <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                  {messages.orders.tableDeviceId}
                </th>
                <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                  {messages.orders.tableImage}
                </th>
                <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                  {messages.orders.tableNote}
                </th>
                <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                  {messages.orders.tableCreatedAt}
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, index) => (
                <tr key={o.id}>
                  <td
                    style={{
                      borderBottom: "1px solid #f3f4f6",
                      padding: 8,
                      textAlign: "center",
                    }}
                  >
                    {index + 1}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f3f4f6",
                      padding: 8,
                      fontSize: 12,
                    }}
                  >
                    {o.deviceId}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f3f4f6",
                      padding: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewUrl(o.imageUrl)}
                      style={{
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        cursor: "zoom-in",
                      }}
                      aria-label="预览订单截图"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={o.imageUrl}
                        alt="order"
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: "cover",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                        }}
                      />
                    </button>
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f3f4f6",
                      padding: 8,
                      fontSize: 12,
                      color: "#4b5563",
                      maxWidth: 200,
                    }}
                  >
                    {o.note || "-"}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f3f4f6",
                      padding: 8,
                      fontSize: 12,
                      color: "#6b7280",
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


