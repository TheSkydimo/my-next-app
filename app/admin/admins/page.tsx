"use client";

import { useEffect, useState } from "react";

type AdminItem = {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
};

export default function AdminAdminsPage() {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isAdmin = window.localStorage.getItem("isAdmin");
      const email = window.localStorage.getItem("adminEmail");
      if (isAdmin === "true" && email) {
        setAdminEmail(email);
      }
    }
  }, []);

  const fetchAdmins = async () => {
    if (!adminEmail) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        adminEmail,
        role: "admin",
        page: "1",
        pageSize: "15",
      });
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "获取管理员列表失败");
      }
      const data = (await res.json()) as {
        users: AdminItem[];
      };
      setAdmins(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取管理员列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminEmail) {
      fetchAdmins();
    }
  }, [adminEmail]);

  const doAction = async (action: "remove" | "unset-admin", item: AdminItem) => {
    if (!adminEmail) return;
    setError("");

    if (action === "remove") {
      const ok = window.confirm(`确定要删除管理员「${item.username}」吗？`);
      if (!ok) return;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail,
          action,
          userEmail: item.email,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "操作失败");
      }

      await fetchAdmins();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  if (!adminEmail) {
    return (
      <div>
        <h1>管理员管理</h1>
        <p>未检测到管理员登录，请先登录。</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <h1>管理员管理</h1>
      <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
        最多允许 15 个管理员。
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading ? (
        <p>加载中...</p>
      ) : admins.length === 0 ? (
        <p>当前没有管理员。</p>
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
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>序号</th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>用户名</th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>邮箱</th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>注册时间</th>
              <th style={{ borderBottom: "1px solid #e5e7eb", padding: 8 }}>操作</th>
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
                  {a.email}
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
                        设为普通用户
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
                        删除
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


