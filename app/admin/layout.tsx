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
import { getAdminMessages } from "../admin-i18n";
import { AdminProvider, useOptionalAdmin } from "../contexts/AdminContext";

/**
 * 管理端布局组件（外层包装）
 * 使用 AdminProvider 提供全局管理员状态
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminProvider>
  );
}

/**
 * 管理端布局内部组件
 * 使用 AdminContext 获取已预加载的管理员信息
 */
function AdminLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const adminContext = useOptionalAdmin();

  // 从 AdminContext 获取管理员信息，避免重复请求
  const isAuthed = adminContext?.isAuthed ?? false;
  const avatarUrl = adminContext?.profile?.avatarUrl ?? null;
  const displayName = adminContext?.profile?.username ?? adminContext?.profile?.email ?? null;
  const adminRole = adminContext?.profile?.role ?? null;
  const initialized = adminContext?.initialized ?? false;

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>("light");
  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const messages = getAdminMessages(language);

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

  const logout = () => {
    // 使用 AdminContext 清除管理员状态
    adminContext?.clearAdmin();
    if (typeof window !== "undefined") {
      // 最佳努力清理服务端 Session Cookie
      void fetch("/api/logout", { method: "POST" }).catch(() => {
        // ignore
      });
      window.location.href = "/admin/login";
    }
  };

  // 已登录管理员，展示侧边栏 + 子页面内容
  const isActive = (href: string) => pathname === href;
  const isSuperAdmin = adminRole === "super_admin";
  const roleLabel =
    adminRole === "super_admin"
      ? messages.layout.roleSuperAdmin
      : adminRole === "admin"
      ? messages.layout.roleAdmin
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
      window.alert(
        `${messages.layout.searchNotFound}${messages.layout.searchNotFoundHint}`
      );
    }
  };

  const isPublicRoute =
    pathname === "/admin/login" || pathname === "/admin/forgot-password";

  // 登录页、找回密码页不做管理员登录校验，直接渲染内容
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // 初始加载阶段，避免闪烁，什么都不渲染
  if (!initialized) {
    return null;
  }

  // 未登录管理员时，不展示内部内容和菜单
  if (!isAuthed) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>{messages.layout.unauthTitle}</h1>
          <p>{messages.layout.unauthDesc}</p>
          <p style={{ marginTop: 12 }}>
            <Link href="/admin/login">{messages.layout.unauthLoginLink}</Link>
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="admin-layout">
      <div className="admin-layout__body">
        {/* 侧边栏外壳（L形左侧） */}
        <aside className="admin-shell admin-shell--sidebar">
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
              {messages.layout.navHome}
            </Link>
            <Link
              href="/admin/profile"
              className={`admin-layout__nav-link ${
                isActive("/admin/profile")
                  ? "admin-layout__nav-link--active"
                  : ""
              }`}
            >
              {messages.layout.navProfile}
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
                {messages.layout.navAdmins}
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
              {messages.layout.navUsers}
            </Link>
            </nav>
        </aside>

        {/* 右侧区域 */}
        <div className="admin-layout__right">
          {/* 顶栏外壳（L形顶部） */}
          <div className="admin-shell admin-shell--topbar">
            <div className="admin-topbar">
                <div className="topbar-brand">
                  <div className="topbar-brand__mark" />
                  <span className="topbar-brand__text">
                    {messages.layout.brand}
                  </span>
                </div>
                <div className="admin-topbar__search">
                  <span className="admin-topbar__search-icon">🔍</span>
                  <input
                    className="admin-topbar__search-input"
                    placeholder={messages.layout.searchPlaceholder}
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
                            {displayName || messages.layout.userMenuNameFallback}
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
                          {messages.layout.userMenuProfile}
                        </button>
                        <button
                          type="button"
                          className="admin-topbar__user-menu-item admin-topbar__user-menu-item--danger"
                          onClick={() => {
                            setUserMenuOpen(false);
                            logout();
                          }}
                        >
                          {messages.layout.userMenuLogout}
                        </button>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>

          {/* 内容区（无外壳） */}
          <main className="admin-layout__content">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

