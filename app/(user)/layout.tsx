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
import { getUserMessages } from "../user-i18n";
import FeedbackBubble from "../components/FeedbackBubble";
import UserNotificationBell from "../components/UserNotificationBell";
import { UserProvider, useOptionalUser } from "../contexts/UserContext";
import { TranslateIcon } from "../components/icons/TranslateIcon";

/**
 * 用户端布局组件（外层包装）
 * 使用 UserProvider 提供全局用户状态
 */
export default function UserLayout({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <UserLayoutInner>{children}</UserLayoutInner>
    </UserProvider>
  );
}

/**
 * 用户端布局内部组件
 * 使用 UserContext 获取已预加载的用户信息
 */
function UserLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const userContext = useOptionalUser();

  // 从 UserContext 获取用户信息，避免重复请求
  const hasUser = !!userContext?.profile;
  const avatarUrl = userContext?.profile?.avatarUrl ?? null;
  const displayName = userContext?.profile?.username ?? userContext?.profile?.email ?? null;

  const [theme, setTheme] = useState<AppTheme>("light");
  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [searchValue, setSearchValue] = useState("");
  // 当前“选中”的左侧菜单组（仅用于高亮，不触发路由/内容更新）
  const [activeNavGroup, setActiveNavGroup] = useState<null | "devices">(null);
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
  const [deviceSubTab, setDeviceSubTab] = useState<"order" | "warranty" | null>(
    null
  );
  // 移动端菜单状态
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const messages = getUserMessages(language);

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

  // 设备信息子菜单：根据当前地址栏 hash 同步“订单信息 / 质保信息”选中态，并在设备页默认展开子菜单
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromLocation = () => {
      if (pathname !== "/devices") {
        setDeviceSubTab(null);
        return;
      }

      const hash = window.location.hash;
      if (hash === "#warranty-section") {
        setDeviceSubTab("warranty");
      } else {
        // 默认选中第一个子菜单：订单信息
        setDeviceSubTab("order");
      }
      setIsDeviceMenuOpen(true);
    };

    syncFromLocation();

    window.addEventListener("hashchange", syncFromLocation);
    return () => {
      window.removeEventListener("hashchange", syncFromLocation);
    };
  }, [pathname]);

  const logout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      // 使用 UserContext 清除用户状态
      userContext?.clearUser();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
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
      {
        href: "/devices",
        keywords: ["设备", "device", "devices"],
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

  // 点击菜单项后在移动端自动关闭侧边栏
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="user-layout">
      <FeedbackBubble />
      <div className="user-layout__body">
        {/* 移动端汉堡菜单按钮 */}
        <button
          type="button"
          className="user-layout__mobile-toggle"
          aria-label={isMobileMenuOpen ? "关闭菜单" : "打开菜单"}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <span className={`user-layout__hamburger ${isMobileMenuOpen ? "user-layout__hamburger--open" : ""}`}>
            <span />
            <span />
            <span />
          </span>
        </button>
        {/*
          移动端遮罩层（必须放在 .user-layout__body 内）
          原因：.user-layout__body 有 z-index，会形成 stacking context；如果遮罩层在 body 外，
          即使 sidebar 自己设置更高 z-index，也会被遮罩层压住，导致移动端“菜单能看到但点不到”。
        */}
        {isMobileMenuOpen && (
          <div
            className="user-layout__mobile-overlay"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
        )}
        <aside className={`user-layout__sidebar ${isMobileMenuOpen ? "user-layout__sidebar--open" : ""}`}>
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
                isActive("/") && activeNavGroup === null
                  ? "user-layout__nav-link--active"
                  : ""
              }`}
              onClick={() => {
                setActiveNavGroup(null);
                closeMobileMenu();
              }}
            >
              {messages.layout.navHome}
            </Link>
            <Link
              href="/profile"
              className={`user-layout__nav-link ${
                isActive("/profile") && activeNavGroup === null
                  ? "user-layout__nav-link--active"
                  : ""
              }`}
              onClick={() => {
                setActiveNavGroup(null);
                closeMobileMenu();
              }}
            >
              {messages.layout.navProfile}
            </Link>
            <div className="user-layout__nav-group">
              <button
                type="button"
                className={`user-layout__nav-link user-layout__nav-link--button ${
                  isActive("/devices") || activeNavGroup === "devices"
                    ? "user-layout__nav-link--active"
                    : ""
                }`}
                onClick={() => {
                  // 可选中父级菜单，但只做展开/收起，不触发内容更新/跳转
                  setActiveNavGroup("devices");
                  const next = !isDeviceMenuOpen;
                  setIsDeviceMenuOpen(next);
                }}
              >
                <span>{messages.layout.navDevices}</span>
                <span className="user-layout__nav-group-arrow">
                  {isDeviceMenuOpen ? "▾" : "▸"}
                </span>
              </button>
              {isDeviceMenuOpen && (
                <div className="user-layout__nav-sub">
                  <Link
                    href="/devices#order-section"
                    className={`user-layout__nav-sub-link ${
                      deviceSubTab === "order"
                        ? "user-layout__nav-sub-link--active"
                        : ""
                    }`}
                    onClick={() => {
                      setActiveNavGroup(null);
                      setDeviceSubTab("order");
                      closeMobileMenu();
                      if (typeof window !== "undefined") {
                        // 通知设备信息页切换到"订单信息"区域
                        window.dispatchEvent(
                          new CustomEvent("user-devices-section-changed", {
                            detail: { section: "order" },
                          })
                        );
                      }
                    }}
                  >
                    {language === "zh-CN" ? "订单信息" : "Order info"}
                  </Link>
                  <Link
                    href="/devices#warranty-section"
                    className={`user-layout__nav-sub-link ${
                      deviceSubTab === "warranty"
                        ? "user-layout__nav-sub-link--active"
                        : ""
                    }`}
                    onClick={() => {
                      setActiveNavGroup(null);
                      setDeviceSubTab("warranty");
                      closeMobileMenu();
                      if (typeof window !== "undefined") {
                        // 通知设备信息页切换到"质保信息"区域
                        window.dispatchEvent(
                          new CustomEvent("user-devices-section-changed", {
                            detail: { section: "warranty" },
                          })
                        );
                      }
                    }}
                  >
                    {language === "zh-CN" ? "质保信息" : "Warranty info"}
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </aside>

        <div className="user-layout__right">
          {hasUser && (
            <div className="user-layout__logout">
              <div className="user-topbar">
                <div className="topbar-brand">
                  <div className="topbar-brand__mark" />
                  <span className="topbar-brand__text">
                    {messages.layout.brand}
                  </span>
                </div>
                <div className="user-topbar__search">
                  <span className="user-topbar__search-icon">🔍</span>
                  <input
                    className="user-topbar__search-input"
                    ref={searchInputRef}
                    placeholder={messages.layout.searchPlaceholder}
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
                  <UserNotificationBell />
                  <button
                    type="button"
                    className="user-topbar__icon-btn user-topbar__icon-btn--translate"
                    aria-label="切换语言"
                    title={language === "zh-CN" ? "切换到 English" : "Switch to 中文"}
                    onClick={toggleLanguage}
                  >
                    <TranslateIcon className="user-topbar__translate-icon" />
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
                    {messages.layout.logout}
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


