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

  if (!adminName) {
    return (
      <div>
        <h1>管理后台</h1>
        <p>未检测到管理员登录，请先登录。</p>
        <Link href="/admin/login">去登录</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "10px auto" }}>
      <h1>管理员后台</h1>
      <p>欢迎，{adminName}</p>
      {adminEmail && (
        <p style={{ fontSize: 14, color: "#6b7280" }}>邮箱：{adminEmail}</p>
      )}

      {/* 其他功能入口已经在左侧菜单中展示，这里只作为首页展示信息 */}
    </div>
  );
}


