"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getAdminMessages } from "../../admin-i18n";

type AdminOrderItem = {
  id: number;
  userEmail: string;
  deviceId: string;
  imageUrl: string;
  note: string | null;
  createdAt: string;
};

export default function AdminOrdersPage() {
  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    if (typeof window !== "undefined") {
      const isAdmin = window.localStorage.getItem("isAdmin");
      const email = window.localStorage.getItem("adminEmail");
      if (isAdmin === "true" && email) {
        setAdminEmail(email);
      }
    }
  }, []);

  useEffect(() => {
    const loadOrders = async (email: string) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          adminEmail: email,
        });
        const res = await fetch(`/api/admin/orders?${params.toString()}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || messages.orders.fetchFailed);
        }
        const data = (await res.json()) as { items: AdminOrderItem[] };
        setOrders(data.items);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : messages.orders.fetchFailed
        );
      } finally {
        setLoading(false);
      }
    };

    if (adminEmail) {
      loadOrders(adminEmail);
    }
  }, [adminEmail, messages.orders.fetchFailed]);

  if (!adminEmail) {
    return (
      <div style={{ maxWidth: 960, margin: "10px auto" }}>
        <h1>{messages.orders.title}</h1>
        <p>{messages.common.adminLoginRequired}</p>
        <Link href="/admin/login">{messages.common.goAdminLogin}</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "10px auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          gap: 12,
        }}
      >
        <div>
          <h1>{messages.orders.title}</h1>
          <p style={{ fontSize: 14, color: "#6b7280" }}>
            {messages.orders.adminLabelPrefix}
            {adminEmail}
          </p>
        </div>
        <Link href="/admin">{messages.orders.backToHome}</Link>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p>{messages.common.loading}</p>
      ) : orders.length === 0 ? (
        <p>{messages.orders.emptyText}</p>
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
                {messages.orders.tableUserEmail}
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
                  {o.userEmail}
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
                  }}
                >
                  {new Date(o.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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


