"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminHomePage() {
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isAdmin = window.localStorage.getItem("isAdmin");
      const name = window.localStorage.getItem("adminName");
      const email = window.localStorage.getItem("adminEmail");
      if (isAdmin === "true") {
        setAdminName(name);
        setAdminEmail(email);
      }
    }
  }, []);

  const logout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("adminEmail");
      window.localStorage.removeItem("adminName");
      window.localStorage.removeItem("isAdmin");
      window.location.href = "/admin/login";
    }
  };

  if (!adminName) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto" }}>
        <h1>管理员后台</h1>
        <p>未检测到管理员登录，请先登录。</p>
        <Link href="/admin/login">去管理员登录</Link>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "80px auto",
        position: "relative",
        paddingTop: 40,
      }}
    >
      <button
        onClick={logout}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
        }}
      >
        退出管理员
      </button>

      <h1>管理员后台</h1>
      <p>欢迎，{adminName}（管理员）</p>
      {adminEmail && (
        <p style={{ fontSize: 14, color: "#6b7280" }}>邮箱：{adminEmail}</p>
      )}

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ fontSize: 18 }}>功能</h2>
        <Link href="/admin/users">用户管理</Link>
      </div>
    </div>
  );
}


