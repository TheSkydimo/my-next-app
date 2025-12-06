"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type UserItem = {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isAdmin = window.localStorage.getItem("isAdmin");
      const email = window.localStorage.getItem("adminEmail");
      if (isAdmin === "true" && email) {
        setAdminEmail(email);
      }
    }
  }, []);

  const fetchUsers = async (q?: string) => {
    if (!adminEmail) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        adminEmail,
      });
      if (q) {
        params.set("q", q);
      }
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "获取用户列表失败");
      }
      const data = (await res.json()) as { users: UserItem[] };
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取用户列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminEmail) {
      fetchUsers();
    }
  }, [adminEmail]);

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
          userId: user.id,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "操作失败");
      }

      await fetchUsers(keyword);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  if (!adminEmail) {
    return (
      <div style={{ maxWidth: 720, margin: "80px auto" }}>
        <h1>用户管理</h1>
        <p>未检测到管理员登录，请先登录管理员后台。</p>
        <Link href="/admin/login">去管理员登录</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "80px auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h1>用户管理</h1>
          <p style={{ fontSize: 14, color: "#6b7280" }}>
            当前管理员：{adminEmail}
          </p>
        </div>
        <Link href="/admin">返回管理员首页</Link>
      </div>

      <div
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
        <button onClick={() => fetchUsers(keyword)} disabled={loading}>
          搜索
        </button>
        <button onClick={() => fetchUsers()} disabled={loading}>
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
                ID
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
                注册时间
              </th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    padding: 8,
                    textAlign: "center",
                  }}
                >
                  {u.id}
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
                  {!u.isAdmin && (
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
                  {u.email !== adminEmail && (
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
    </div>
  );
}


