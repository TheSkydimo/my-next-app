"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function UserLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [hasUser, setHasUser] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const email = window.localStorage.getItem("loggedInUserEmail");
      const nickname = window.localStorage.getItem("loggedInUserName");
      const storedAvatar = window.localStorage.getItem("loggedInUserAvatar");

      setHasUser(!!email);
      setDisplayName(nickname || email);
      setAvatarUrl(storedAvatar || null);

      // 尝试从后端刷新一次头像和昵称（忽略错误，不打断页面）
      if (email) {
        fetch(`/api/user/profile?email=${encodeURIComponent(email)}`)
          .then(async (res) => {
            if (!res.ok) return;
            const data = (await res.json()) as {
              username: string;
              email: string;
              avatarUrl: string | null;
            };
            setDisplayName(data.username || data.email);
            setAvatarUrl(data.avatarUrl ?? null);

            window.localStorage.setItem(
              "loggedInUserName",
              data.username || ""
            );
            if (data.avatarUrl) {
              window.localStorage.setItem(
                "loggedInUserAvatar",
                data.avatarUrl
              );
            } else {
              window.localStorage.removeItem("loggedInUserAvatar");
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  // 监听来自资料页的头像更新事件，实时同步右上角头像
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{
        avatarUrl: string | null;
        displayName?: string | null;
      }>;
      const detail = custom.detail;
      if (!detail) return;
      setAvatarUrl(detail.avatarUrl);
      if (detail.displayName) {
        setDisplayName(detail.displayName);
      }
    };

    window.addEventListener("user-avatar-updated", handler as EventListener);
    return () => {
      window.removeEventListener(
        "user-avatar-updated",
        handler as EventListener
      );
    };
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
        <div
          style={{
            position: "fixed",
            top: 10,
            right: 20,
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            title={displayName || undefined}
            style={{
              width: 56,
              height: 56,
              borderRadius: "9999px",
              overflow: "hidden",
              border: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f9fafb",
              fontSize: 14,
              color: "#4b5563",
              cursor: "pointer",
            }}
            onClick={() => {
              if (pathname !== "/profile") {
                window.location.href = "/profile";
              }
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="用户头像"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span>
                {displayName
                  ? displayName.trim().charAt(0).toUpperCase()
                  : "U"}
              </span>
            )}
          </div>
          <button type="button" onClick={logout}>
            退出登录
          </button>
        </div>
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


