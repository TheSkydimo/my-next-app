"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // 登录页、找回密码页不做管理员登录校验，直接渲染内容
  if (pathname === "/admin/login" || pathname === "/admin/forgot-password") {
    return <>{children}</>;
  }

  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isAdmin = window.localStorage.getItem("isAdmin");
      const email = window.localStorage.getItem("adminEmail");
      setIsAuthed(isAdmin === "true" && !!email);
    }
  }, []);

  // 初始加载阶段，避免闪烁，什么都不渲染
  if (isAuthed === null) {
    return null;
  }

  // 未登录管理员时，不展示内部内容和菜单
  if (!isAuthed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1>管理后台</h1>
          <p>未检测到管理员登录，请先登录。</p>
          <Link href="/admin/login">去登录</Link>
        </div>
      </div>
    );
  }

  // 已登录管理员，展示侧边栏 + 子页面内容
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 200,
          borderRight: "1px solid #e5e7eb",
          padding: "24px 16px",
          boxSizing: "border-box",
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>管理后台</h2>
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 14,
          }}
        >
          <Link href="/admin">首页</Link>
          <Link href="/admin/profile">信息管理</Link>
          <Link href="/admin/admins">管理员管理</Link>
          <Link href="/admin/users">用户管理</Link>
        </nav>
      </aside>

      <main
        style={{
          flex: 1,
          padding: "24px 32px",
          boxSizing: "border-box",
          overflowX: "auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}

