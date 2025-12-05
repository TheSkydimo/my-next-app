"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminHomePage() {
  const [adminName, setAdminName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isAdmin = window.localStorage.getItem("isAdmin");
      const name = window.localStorage.getItem("adminName");
      if (isAdmin === "true") {
        setAdminName(name);
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

      <p style={{ marginTop: 16, fontSize: 14, color: "#6b7280" }}>
        这里可以扩展为真正的后台管理页面，比如用户列表、权限管理等。
      </p>
    </div>
  );
}


