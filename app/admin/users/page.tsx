"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

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
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isAdmin = window.localStorage.getItem("isAdmin");
      const email = window.localStorage.getItem("adminEmail");
      if (isAdmin === "true" && email) {
        setAdminEmail(email);
        const role = window.localStorage.getItem("adminRole");
        setIsSuperAdmin(role === "super_admin");
      }
    }
  }, []);

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
          throw new Error(text || "获取用户列表失败");
        }
        const data = (await res.json()) as {
          users: UserItem[];
          pagination: Pagination;
        };
        setUsers(data.users);
        setPagination(data.pagination);
        setPage(data.pagination.page);
      } catch (e) {
        setError(e instanceof Error ? e.message : "获取用户列表失败");
      } finally {
        setLoading(false);
      }
    },
    [adminEmail, page]
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
      const ok = window.confirm(`确定要删除用户「${user.username}」吗？`);
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
        throw new Error(text || "操作失败");
      }

      await fetchUsers({ q: keyword });
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  const setVipForUser = async (user: UserItem) => {
    if (!adminEmail) return;
    setError("");

    const currentDateText = user.vipExpiresAt
      ? user.vipExpiresAt.slice(0, 10)
      : "";
    const input = window.prompt(
      "请输入会员到期日期（格式：YYYY-MM-DD），留空表示取消会员：",
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
        throw new Error(text || "设置会员失败");
      }

      await fetchUsers({ q: keyword });
    } catch (e) {
      setError(e instanceof Error ? e.message : "设置会员失败");
    }
  };

  if (!adminEmail) {
    return (
      <div style={{ maxWidth: 720, margin: "10px auto" }}>
        <h1>普通用户管理</h1>
        <p>未检测到管理员登录，请先登录管理员后台。</p>
        <Link href="/admin/login">去管理员登录</Link>
      </div>
    );
  }

  return (
    <div className="admin-users" style={{ maxWidth: 960, margin: "10px auto" }}>
      <div
        className="admin-users__header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          gap: 12,
        }}
      >
        <div>
          <h1>普通用户管理</h1>
          <p style={{ fontSize: 14, color: "#6b7280" }}>
            当前管理员：{adminEmail}
          </p>
        </div>
        <Link href="/admin">返回管理员首页</Link>
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
          placeholder="按用户名或邮箱搜索"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          onClick={() => fetchUsers({ q: keyword, page: 1 })}
          disabled={loading}
        >
          搜索
        </button>
        <button
          onClick={() => {
            setKeyword("");
            fetchUsers({ q: "", page: 1 });
          }}
          disabled={loading}
        >
          重置
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p>加载中...</p>
      ) : users.length === 0 ? (
        <p>暂无用户。</p>
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
                序号
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                用户名
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                邮箱
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                角色
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                会员状态
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                会员到期时间
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                注册时间
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                操作
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
                  {u.email}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    padding: 8,
                    textAlign: "center",
                  }}
                >
                  {u.isAdmin ? "管理员" : "普通用户"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    padding: 8,
                    textAlign: "center",
                    color: u.isVip ? "#16a34a" : "#6b7280",
                  }}
                >
                  {u.isVip ? "会员中" : "非会员"}
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
                    设置会员
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
                      设为管理员
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
                      删除
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
            上一页
          </button>
          <span>
            第 {page} / {pagination.totalPages} 页（共 {pagination.total} 个用户）
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
            下一页
          </button>
        </div>
      )}
    </div>
  );
}


