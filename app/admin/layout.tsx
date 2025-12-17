"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  applyLanguage,
  applyTheme,
  getInitialLanguage,
  getInitialTheme,
  type AppLanguage,
  type AppTheme,
} from "../client-prefs";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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

  // 初始化主题 / 语言，并处理 Ctrl + K 聚焦搜索框
  useEffect(() => {
    const initialTheme = getInitialTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);

    const initialLang = getInitialLanguage();
    setLanguage(initialLang);
    applyLanguage(initialLang);

    const keyHandler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", keyHandler);
    return () => {
      window.removeEventListener("keydown", keyHandler);
    };
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

  const toggleTheme = () => {
    const next: AppTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const toggleLanguage = () => {
    const next: AppLanguage = language === "zh-CN" ? "en-US" : "zh-CN";
    setLanguage(next);
    applyLanguage(next);
  };

  const triggerSearch = () => {
    if (typeof window === "undefined") return;
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return;

    const routes: { href: string; keywords: string[] }[] = [
      { href: "/admin", keywords: ["首页", "home", "dashboard"] },
      {
        href: "/admin/users",
        keywords: ["用户", "users", "user"],
      },
      {
        href: "/admin/admins",
        keywords: ["管理员", "admin", "admins"],
      },
      {
        href: "/admin/profile",
        keywords: ["信息", "资料", "profile", "account"],
      },
    ];

    const matched = routes.find((r) =>
      r.keywords.some((k) => keyword.includes(k.toLowerCase()))
    );

    if (matched) {
      window.location.href = matched.href;
    } else {
      window.alert("未找到相关功能，请尝试：用户 / 管理员 / 信息 / 首页");
    }
  };

  return (
    <div className="admin-layout">
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

        <div className="admin-layout__right">
          <main className="admin-layout__main">
            {/* 右侧顶部横向工具栏：搜索 + 快捷操作 + 用户头像 */}
            <div className="admin-layout__logout">
              <div className="admin-topbar">
                <div className="topbar-brand">
                  <div className="topbar-brand__mark" />
                  <span className="topbar-brand__text">Skydimo Admin</span>
                </div>
                <div className="admin-topbar__search">
                  <span className="admin-topbar__search-icon">🔍</span>
                  <input
                    className="admin-topbar__search-input"
                    placeholder="搜索功能 / Ctrl + K"
                    ref={searchInputRef}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        triggerSearch();
                      }
                    }}
                  />
                </div>

                <div className="admin-topbar__actions">
                  <button
                    type="button"
                    className="admin-topbar__icon-btn"
                    aria-label="通知"
                  >
                    🔔
                  </button>
                  <button
                    type="button"
                    className="admin-topbar__icon-btn admin-topbar__icon-btn--translate"
                    aria-label="切换语言"
                    title={language === "zh-CN" ? "切换到 English" : "Switch to 中文"}
                    onClick={toggleLanguage}
                  >
                    <span className="admin-topbar__lang-label">
                      {language === "zh-CN" ? "中" : "EN"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="admin-topbar__icon-btn"
                    aria-label="切换主题样式"
                    title={theme === "dark" ? "切换为浅色主题" : "切换为深色主题"}
                    onClick={toggleTheme}
                  >
                    🌓
                  </button>
                  <div className="admin-topbar__avatar-wrapper">
                    <button
                      type="button"
                      className="admin-topbar__avatar-btn"
                      onClick={() => setUserMenuOpen((v) => !v)}
                      aria-haspopup="true"
                      aria-expanded={userMenuOpen}
                    >
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt="管理员头像"
                          className="admin-topbar__avatar-img"
                        />
                      ) : (
                        <span className="admin-topbar__avatar-initial">
                          {displayName
                            ? displayName.trim().charAt(0).toUpperCase()
                            : "A"}
                        </span>
                      )}
                    </button>

                    {userMenuOpen && (
                      <div className="admin-topbar__user-menu">
                        <div className="admin-topbar__user-meta">
                          <div className="admin-topbar__user-name">
                            {displayName || "管理员"}
                          </div>
                          {roleLabel && (
                            <div className="admin-topbar__user-role">
                              {roleLabel}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="admin-topbar__user-menu-item"
                          onClick={() => {
                            window.location.href = "/admin/profile";
                            setUserMenuOpen(false);
                          }}
                        >
                          个人中心
                        </button>
                        <button
                          type="button"
                          className="admin-topbar__user-menu-item admin-topbar__user-menu-item--danger"
                          onClick={() => {
                            setUserMenuOpen(false);
                            logout();
                          }}
                        >
                          退出登录
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

