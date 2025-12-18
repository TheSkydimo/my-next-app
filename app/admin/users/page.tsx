"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getAdminMessages } from "../../admin-i18n";
import { useAdmin } from "../../contexts/AdminContext";

type UserItem = {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  isVip: boolean;
  vipExpiresAt: string | null;
  createdAt: string;
};

type Pagination = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export default function AdminUsersPage() {
  // 使用 AdminContext 获取预加载的管理员信息
  const adminContext = useAdmin();
  const adminEmail = adminContext.profile?.email ?? null;
  const isSuperAdmin = adminContext.profile?.isSuperAdmin ?? false;

  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);

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

  const fetchUsers = useCallback(
    async (opts?: { q?: string; page?: number }) => {
      if (!adminEmail) return;
      const { q, page: pageArg } = opts ?? {};
      const pageToUse = pageArg ?? page;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          adminEmail,
          role: "user",
          page: String(pageToUse),
          pageSize: "15",
        });
        if (q) {
          params.set("q", q);
        }
        const res = await fetch(`/api/admin/users?${params.toString()}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || messages.users.fetchFailed);
        }
        const data = (await res.json()) as {
          users: UserItem[];
          pagination: Pagination;
        };
        setUsers(data.users);
        setPagination(data.pagination);
        setPage(data.pagination.page);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : messages.users.fetchFailed
        );
      } finally {
        setLoading(false);
      }
    },
    [adminEmail, page, messages.users.fetchFailed]
  );

  useEffect(() => {
    if (adminEmail) {
      fetchUsers();
    }
  }, [adminEmail, fetchUsers]);

  const doAction = async (action: "remove" | "set-admin", user: UserItem) => {
    if (!adminEmail) return;
    setError("");

    if (action === "remove") {
      const ok = window.confirm(
        messages.users.deleteConfirm(user.username)
      );
      if (!ok) return;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail,
          action,
          userEmail: user.email,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.users.actionFailed);
      }

      await fetchUsers({ q: keyword });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : messages.users.actionFailed
      );
    }
  };

  const setVipForUser = async (user: UserItem) => {
    if (!adminEmail) return;
    setError("");

    const currentDateText = user.vipExpiresAt
      ? user.vipExpiresAt.slice(0, 10)
      : "";
    const input = window.prompt(
      messages.users.setVipPrompt(currentDateText),
      currentDateText
    );
    if (input === null) return;

    const trimmed = input.trim();
    let vipExpiresAt: string | null = null;
    if (trimmed) {
      // 简单拼一个 UTC 的结束时间，后端会做格式校验
      vipExpiresAt = `${trimmed}T23:59:59.999Z`;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail,
          action: "set-vip",
          userEmail: user.email,
          vipExpiresAt,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.users.setVipFailed);
      }

      await fetchUsers({ q: keyword });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : messages.users.setVipFailed
      );
    }
  };

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
            <h1 className="vben-page__title">{messages.users.title}</h1>
            <p className="vben-page__subtitle">
              {messages.users.adminLabelPrefix}
              {adminEmail}
            </p>
          </div>
          <Link href="/admin" className="btn btn-secondary btn-sm">{messages.users.backToHome}</Link>
        </div>
      </div>

      <div
        className="admin-users__search-row"
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <input
          placeholder={messages.users.searchPlaceholder}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          onClick={() => fetchUsers({ q: keyword, page: 1 })}
          disabled={loading}
        >
          {messages.users.searchButton}
        </button>
        <button
          onClick={() => {
            setKeyword("");
            fetchUsers({ q: "", page: 1 });
          }}
          disabled={loading}
        >
          {messages.users.resetButton}
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p>{messages.common.loading}</p>
      ) : users.length === 0 ? (
        <p>{messages.users.emptyText}</p>
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
                {messages.users.tableIndex}
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                {messages.users.tableUsername}
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                {messages.users.tableEmail}
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                {messages.users.tableRole}
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                {messages.users.tableVipStatus}
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                {messages.users.tableVipExpiresAt}
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                {messages.users.tableCreatedAt}
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                {messages.users.tableActions}
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, index) => (
              <tr key={u.id}>
                <td
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    padding: 8,
                    textAlign: "center",
                  }}
                >
                  {pagination
                    ? (pagination.page - 1) * pagination.pageSize + index + 1
                    : index + 1}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    padding: 8,
                  }}
                >
                  {u.username}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    padding: 8,
                  }}
                >
                  <Link
                    href={`/admin/users/${encodeURIComponent(u.email)}`}
                    style={{ color: "#2563eb", textDecoration: "underline" }}
                    title={
                      language === "zh-CN"
                        ? "查看该用户详情与订单截图"
                        : "View user details and order screenshots"
                    }
                  >
                    {u.email}
                  </Link>
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    padding: 8,
                    textAlign: "center",
                  }}
                >
                  {u.isAdmin
                    ? messages.users.roleAdmin
                    : messages.users.roleUser}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    padding: 8,
                    textAlign: "center",
                    color: u.isVip ? "#16a34a" : "#6b7280",
                  }}
                >
                  {u.isVip ? messages.users.vipOn : messages.users.vipOff}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    padding: 8,
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  {u.vipExpiresAt
                    ? new Date(u.vipExpiresAt).toLocaleString()
                    : "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    padding: 8,
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  {u.createdAt}
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
                  <button
                    onClick={() => setVipForUser(u)}
                    style={{
                      background: "#0ea5e9",
                      borderColor: "#0ea5e9",
                      color: "#fff",
                      padding: "4px 8px",
                    }}
                  >
                    {messages.users.btnSetVip}
                  </button>
                  {!u.isAdmin && isSuperAdmin && (
                    <button
                      onClick={() => doAction("set-admin", u)}
                      style={{
                        background: "#10b981",
                        borderColor: "#10b981",
                        color: "#fff",
                        padding: "4px 8px",
                      }}
                    >
                      {messages.users.btnSetAdmin}
                    </button>
                  )}
                  {u.email !== adminEmail && !u.isVip && (
                    <button
                      onClick={() => doAction("remove", u)}
                      style={{
                        background: "#ef4444",
                        borderColor: "#ef4444",
                        color: "#fff",
                        padding: "4px 8px",
                      }}
                    >
                      {messages.users.btnDelete}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "center",
            gap: 12,
            alignItems: "center",
            fontSize: 14,
          }}
        >
          <button
            onClick={() =>
              fetchUsers({ q: keyword, page: Math.max(page - 1, 1) })
            }
            disabled={page <= 1 || loading}
          >
            {messages.users.pagerPrev}
          </button>
          <span>
            {messages.users.pagerText(
              page,
              pagination.totalPages,
              pagination.total
            )}
          </span>
          <button
            onClick={() =>
              fetchUsers({
                q: keyword,
                page: Math.min(page + 1, pagination.totalPages),
              })
            }
            disabled={page >= pagination.totalPages || loading}
          >
            {messages.users.pagerNext}
          </button>
        </div>
      )}
    </div>
  );
}


