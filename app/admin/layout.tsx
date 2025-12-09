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
      <div className="auth-page">
        <div className="auth-card">
          <h1>管理后台</h1>
          <p>未检测到管理员登录，请先登录。</p>
          <p style={{ marginTop: 12 }}>
            <Link href="/admin/login">去登录</Link>
          </p>
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
    <div className="admin-layout">
      {/* 右上角仅保留退出登录按钮，头像移动到左侧栏顶部 */}
      <div className="admin-layout__logout">
        <button type="button" onClick={logout}>
          退出登录
        </button>
      </div>

      <div className="admin-layout__body">
        <aside className="admin-layout__sidebar">
          {isAuthed && (
            <div className="admin-layout__profile">
              <div
                title={displayName || undefined}
                className="admin-layout__avatar"
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
                    className="admin-layout__avatar-img"
                  />
                ) : (
                  <span className="admin-layout__avatar-initial">
                    {displayName
                      ? displayName.trim().charAt(0).toUpperCase()
                      : "A"}
                  </span>
                )}
              </div>

              <div className="admin-layout__profile-meta">
                {displayName && (
                  <div
                    className="admin-layout__display-name"
                    title={displayName}
                  >
                    {displayName}
                  </div>
                )}
                {roleLabel && (
                  <span
                    className={`admin-layout__role-badge ${
                      isSuperAdmin
                        ? "admin-layout__role-badge--super"
                        : "admin-layout__role-badge--normal"
                    }`}
                  >
                    {roleLabel}
                  </span>
                )}
              </div>
            </div>
          )}
          <nav className="admin-layout__nav">
            <Link
              href="/admin"
              className={`admin-layout__nav-link ${
                isActive("/admin") ? "admin-layout__nav-link--active" : ""
              }`}
            >
              首页
            </Link>
            <Link
              href="/admin/profile"
              className={`admin-layout__nav-link ${
                isActive("/admin/profile")
                  ? "admin-layout__nav-link--active"
                  : ""
              }`}
            >
              信息管理
            </Link>
            {isSuperAdmin && (
              <Link
                href="/admin/admins"
                className={`admin-layout__nav-link ${
                  isActive("/admin/admins")
                    ? "admin-layout__nav-link--active"
                    : ""
                }`}
              >
                管理员管理
              </Link>
            )}
            <Link
              href="/admin/users"
              className={`admin-layout__nav-link ${
                isActive("/admin/users")
                  ? "admin-layout__nav-link--active"
                  : ""
              }`}
            >
              用户管理
            </Link>
          </nav>
        </aside>

        <main className="admin-layout__main">
          {children}
        </main>
      </div>
    </div>
  );
}

