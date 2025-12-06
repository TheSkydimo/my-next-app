"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function UserLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const email = window.localStorage.getItem("loggedInUserEmail");
      setHasUser(!!email);
    }
  }, []);

  const logout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("loggedInUserEmail");
      window.localStorage.removeItem("loggedInUserName");
      window.location.href = "/login";
    }
  };

  // 登录、注册、忘记密码等页面不需要左侧菜单和退出按钮
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password"
  ) {
    return <>{children}</>;
  }

  const isActive = (href: string) => pathname === href;

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      {hasUser && (
        <button
          type="button"
          onClick={logout}
          style={{
            position: "fixed",
            top: 16,
            right: 24,
            zIndex: 60,
          }}
        >
          退出登录
        </button>
      )}

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
            <Link
              href="/"
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                backgroundColor: isActive("/") ? "#1d4ed8" : "transparent",
                color: isActive("/") ? "#ffffff" : "#111827",
                fontWeight: isActive("/") ? 600 : 400,
              }}
            >
              首页
            </Link>
            <Link
              href="/profile"
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                backgroundColor: isActive("/profile")
                  ? "#1d4ed8"
                  : "transparent",
                color: isActive("/profile") ? "#ffffff" : "#111827",
                fontWeight: isActive("/profile") ? 600 : 400,
              }}
            >
              信息管理
            </Link>
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
    </div>
  );
}


