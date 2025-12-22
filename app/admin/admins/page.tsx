"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getAdminMessages } from "../../admin-i18n";
import { useAdmin } from "../../contexts/AdminContext";
import { useAutoDismissMessage } from "../../hooks/useAutoDismissMessage";

type AdminItem = {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
};

export default function AdminAdminsPage() {
  // 使用 AdminContext 获取预加载的管理员信息
  const adminContext = useAdmin();
  const isSuperAdmin = adminContext.profile?.isSuperAdmin ?? false;
  const adminEmail = isSuperAdmin ? (adminContext.profile?.email ?? null) : null;
  const unauthorized = adminContext.initialized && !isSuperAdmin;

  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useAutoDismissMessage(2000);

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

  const messages = getAdminMessages(language);

  const fetchAdmins = useCallback(async () => {
    if (!adminEmail) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        role: "admin",
        page: "1",
        pageSize: "15",
      });
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.admins.fetchFailed);
      }
      const data = (await res.json()) as {
        users: AdminItem[];
      };
      setAdmins(data.users);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : messages.admins.fetchFailed
      );
    } finally {
      setLoading(false);
    }
  }, [adminEmail, messages.admins.fetchFailed]);

  useEffect(() => {
    if (adminEmail) {
      fetchAdmins();
    }
  }, [adminEmail, fetchAdmins]);

  const doAction = async (action: "remove" | "unset-admin", item: AdminItem) => {
    if (!adminEmail) return;
    setError("");

    if (action === "remove") {
      const ok = window.confirm(messages.admins.deleteConfirm(item.username));
      if (!ok) return;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          userEmail: item.email,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.admins.actionFailed);
      }

      await fetchAdmins();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : messages.admins.actionFailed
      );
    }
  };

  if (unauthorized) {
    return (
      <div className="vben-page">
        <div className="vben-page__header">
          <h1 className="vben-page__title">{messages.admins.title}</h1>
        </div>
        <p>{messages.admins.unauthorizedDesc}</p>
      </div>
    );
  }

  if (!adminEmail) {
    return (
      <div className="vben-page">
        <div className="vben-page__header">
          <h1 className="vben-page__title">{messages.admins.title}</h1>
        </div>
        <p>{messages.common.adminLoginRequired}</p>
        <Link href="/admin/login">{messages.common.goAdminLogin}</Link>
      </div>
    );
  }

  return (
    <div className="vben-page">
      <div className="vben-page__header">
        <h1 className="vben-page__title">{messages.admins.title}</h1>
        <p className="vben-page__subtitle">{messages.admins.limitTip}</p>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading ? (
        <p>{messages.common.loading}</p>
      ) : admins.length === 0 ? (
        <p>{messages.admins.emptyText}</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
            marginTop: 16,
          }}
        >
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                {messages.admins.tableIndex}
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                {messages.admins.tableUsername}
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                {messages.admins.tableEmail}
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                {messages.admins.tableCreatedAt}
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                {messages.admins.tableActions}
              </th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a, index) => (
              <tr key={a.id}>
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
                  }}
                >
                  {a.username}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    padding: 8,
                  }}
                >
                  <Link
                    href={`/admin/users/${encodeURIComponent(a.email)}`}
                    style={{ color: "#2563eb", textDecoration: "underline" }}
                    title={
                      language === "zh-CN"
                        ? "查看该管理员详情与订单截图"
                        : "View this admin's details and order screenshots"
                    }
                  >
                    {a.email}
                  </Link>
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    padding: 8,
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  {a.createdAt}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    padding: 8,
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                  }}
                >
                  {a.email !== adminEmail && (
                    <>
                      <button
                        onClick={() => doAction("unset-admin", a)}
                        style={{
                          background: "#6b7280",
                          borderColor: "#6b7280",
                          color: "#fff",
                          padding: "4px 8px",
                        }}
                      >
                        {messages.admins.btnUnsetAdmin}
                      </button>
                      <button
                        onClick={() => doAction("remove", a)}
                        style={{
                          background: "#ef4444",
                          borderColor: "#ef4444",
                          color: "#fff",
                          padding: "4px 8px",
                        }}
                      >
                        {messages.admins.btnDelete}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}


