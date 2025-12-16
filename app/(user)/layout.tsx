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

  // 未登录普通用户时，不展示左侧菜单和退出按钮，只渲染当前页面内容
  if (!hasUser) {
    return <>{children}</>;
  }

  const isActive = (href: string) => pathname === href;

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
                <div className="user-topbar__search">
                  <span className="user-topbar__search-icon">🔍</span>
                  <input
                    className="user-topbar__search-input"
                    placeholder="搜索功能 / Ctrl + K"
                  />
                </div>

                <div className="user-topbar__actions">
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


