"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function UserLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // 登录、注册、忘记密码等页面不需要左侧菜单
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password"
  ) {
    return <>{children}</>;
  }

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
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>用户中心</h2>
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 14,
          }}
        >
          <Link href="/">首页</Link>
          <Link href="/profile">信息管理</Link>
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


