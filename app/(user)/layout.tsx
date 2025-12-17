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

export default function UserLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [hasUser, setHasUser] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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

  // 未登录普通用户时，不展示左侧菜单和退出按钮，只渲染当前页面内容
  if (!hasUser) {
    return <>{children}</>;
  }

  const isActive = (href: string) => pathname === href;

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
      { href: "/", keywords: ["首页", "home", "index"] },
      { href: "/profile", keywords: ["信息", "资料", "profile", "account"] },
      { href: "/devices", keywords: ["设备", "device", "devices"] },
    ];

    const matched = routes.find((r) =>
      r.keywords.some((k) => keyword.includes(k.toLowerCase()))
    );

    if (matched) {
      window.location.href = matched.href;
    } else {
      window.alert("未找到相关功能，请尝试：首页 / 信息 / 设备");
    }
  };

  return (
    <div className="user-layout">
      <div className="user-layout__body">
        <aside className="user-layout__sidebar">
          {hasUser && (
            <div className="user-layout__profile">
              <div
                className="user-layout__avatar"
                title={displayName || undefined}
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
                    className="user-layout__avatar-img"
                  />
                ) : (
                  <span className="user-layout__avatar-initial">
                    {displayName
                      ? displayName.trim().charAt(0).toUpperCase()
                      : "U"}
                  </span>
                )}
              </div>

              {displayName && (
                <div
                  className="user-layout__display-name"
                  title={displayName}
                >
                  {displayName}
                </div>
              )}
            </div>
          )}
          <nav className="user-layout__nav">
            <Link
              href="/"
              className={`user-layout__nav-link ${
                isActive("/") ? "user-layout__nav-link--active" : ""
              }`}
            >
              首页
            </Link>
            <Link
              href="/profile"
              className={`user-layout__nav-link ${
                isActive("/profile") ? "user-layout__nav-link--active" : ""
              }`}
            >
              信息管理
            </Link>
            <Link
              href="/devices"
              className={`user-layout__nav-link ${
                isActive("/devices") ? "user-layout__nav-link--active" : ""
              }`}
            >
              设备信息管理
            </Link>
          </nav>
        </aside>

        <div className="user-layout__right">
          {hasUser && (
            <div className="user-layout__logout">
              <div className="user-topbar">
                <div className="topbar-brand">
                  <div className="topbar-brand__mark" />
                  <span className="topbar-brand__text">Skydimo</span>
                </div>
                <div className="user-topbar__search">
                  <span className="user-topbar__search-icon">🔍</span>
                  <input
                    className="user-topbar__search-input"
                    ref={searchInputRef}
                    placeholder="搜索功能 / Ctrl + K"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        triggerSearch();
                      }
                    }}
                  />
                </div>

                <div className="user-topbar__actions">
                  {/* 全局设置：语言 / 样式 / 退出 */}
                  <button
                    type="button"
                    className="user-topbar__icon-btn user-topbar__icon-btn--translate"
                    aria-label="切换语言"
                    title={language === "zh-CN" ? "切换到 English" : "Switch to 中文"}
                    onClick={toggleLanguage}
                  >
                    <span className="user-topbar__lang-label">
                      {language === "zh-CN" ? "中" : "EN"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="user-topbar__icon-btn"
                    aria-label="切换主题样式"
                    title={theme === "dark" ? "切换为浅色主题" : "切换为深色主题"}
                    onClick={toggleTheme}
                  >
                    🌓
                  </button>
                  <button
                    type="button"
                    className="user-topbar__icon-btn"
                    onClick={logout}
                  >
                    退出
                  </button>
                </div>
              </div>
            </div>
          )}

          <main className="user-layout__main">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}


