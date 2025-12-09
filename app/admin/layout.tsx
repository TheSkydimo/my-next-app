"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isAdmin = window.localStorage.getItem("isAdmin");
      const email = window.localStorage.getItem("adminEmail");
      const storedAvatar = window.localStorage.getItem("adminAvatarUrl");
      const storedRole = window.localStorage.getItem("adminRole");

      setIsAuthed(isAdmin === "true" && !!email);
      setAvatarUrl(storedAvatar || null);
      setAdminRole(storedRole || null);

      // 尝试从后端刷新一次管理员头像（忽略错误）
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
            if (data.avatarUrl) {
              window.localStorage.setItem("adminAvatarUrl", data.avatarUrl);
            } else {
              window.localStorage.removeItem("adminAvatarUrl");
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  // 监听来自管理员资料页的头像更新事件，实时同步右上角头像
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

    window.addEventListener("admin-avatar-updated", handler as EventListener);
    return () => {
      window.removeEventListener(
        "admin-avatar-updated",
        handler as EventListener
      );
    };
  }, []);

  const logout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("adminEmail");
      window.localStorage.removeItem("isAdmin");
      window.location.href = "/admin/login";
    }
  };

  const isPublicRoute =
    pathname === "/admin/login" || pathname === "/admin/forgot-password";

  // 登录页、找回密码页不做管理员登录校验，直接渲染内容
  if (isPublicRoute) {
    return <>{children}</>;
  }

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
  const isActive = (href: string) => pathname === href;
  const isSuperAdmin = adminRole === "super_admin";
  const roleLabel =
    adminRole === "super_admin"
      ? "超级管理员"
      : adminRole === "admin"
      ? "管理员"
      : null;

  return (
    <div
      className="admin-layout"
      style={{ position: "relative", minHeight: "100vh" }}
    >
      {/* 右上角仅保留退出登录按钮，头像移动到左侧栏顶部 */}
      <div
        style={{
          position: "fixed",
          top: 10,
          right: 20,
          zIndex: 60,
        }}
      >
        <button type="button" onClick={logout}>
          退出登录
        </button>
      </div>

      <div className="admin-layout__body" style={{ display: "flex", minHeight: "100vh" }}>
        <aside
          className="admin-layout__sidebar"
          style={{
            width: 200,
            borderRight: "1px solid #e5e7eb",
            padding: "24px 16px",
            boxSizing: "border-box",
          }}
        >
          {isAuthed && (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
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
                  flexShrink: 0,
                }}
                onClick={() => {
                  if (pathname !== "/admin/profile") {
                    window.location.href = "/admin/profile";
                  }
                }}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="管理员头像"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span>
                    {displayName
                      ? displayName.trim().charAt(0).toUpperCase()
                      : "A"}
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  minWidth: 0,
                }}
              >
                {displayName && (
                  <div
                    style={{
                      fontSize: 14,
                      color: "#111827",
                      maxWidth: "100%",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis", // 用户名过长时用“...”省略
                    }}
                    title={displayName}
                  >
                    {displayName}
                  </div>
                )}
                {roleLabel && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 9999,
                      fontSize: 12,
                      backgroundColor: isSuperAdmin ? "#dcfce7" : "#e0f2fe",
                      color: isSuperAdmin ? "#166534" : "#1d4ed8",
                      alignSelf: "flex-start",
                    }}
                  >
                    {roleLabel}
                  </span>
                )}
              </div>
            </div>
          )}
          <nav
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 14,
            }}
          >
            <Link
              href="/admin"
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                backgroundColor: isActive("/admin")
                  ? "#1d4ed8"
                  : "transparent",
                color: isActive("/admin") ? "#ffffff" : "#111827",
                fontWeight: isActive("/admin") ? 600 : 400,
              }}
            >
              首页
            </Link>
            <Link
              href="/admin/profile"
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                backgroundColor: isActive("/admin/profile")
                  ? "#1d4ed8"
                  : "transparent",
                color: isActive("/admin/profile") ? "#ffffff" : "#111827",
                fontWeight: isActive("/admin/profile") ? 600 : 400,
              }}
            >
              信息管理
            </Link>
            {isSuperAdmin && (
              <Link
                href="/admin/admins"
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  backgroundColor: isActive("/admin/admins")
                    ? "#1d4ed8"
                    : "transparent",
                  color: isActive("/admin/admins") ? "#ffffff" : "#111827",
                  fontWeight: isActive("/admin/admins") ? 600 : 400,
                }}
              >
                管理员管理
              </Link>
            )}
            <Link
              href="/admin/users"
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                backgroundColor: isActive("/admin/users")
                  ? "#1d4ed8"
                  : "transparent",
                color: isActive("/admin/users") ? "#ffffff" : "#111827",
                fontWeight: isActive("/admin/users") ? 600 : 400,
              }}
            >
              用户管理
            </Link>
          </nav>
        </aside>

        <main
          className="admin-layout__main"
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

