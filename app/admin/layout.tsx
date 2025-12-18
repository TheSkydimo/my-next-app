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

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const messages = getAdminMessages(language);

  type FeedbackItem = {
    id: number;
    userEmail: string;
    type: string | null;
    content: string;
    status: string;
    createdAt: string;
    readAt: string | null;
    latestReplyAt: string | null;
    latestReplyAdminEmail: string | null;
    latestReplyContent: string | null;
    closedAt: string | null;
  };

  const [feedbackBadge, setFeedbackBadge] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  const renderTypeLabel = (rawType: string | null) => {
    const t = rawType || "other";
    if (language === "zh-CN") {
      switch (t) {
        case "bug":
          return "功能异常 / Bug";
        case "feature":
          return "功能建议";
        case "billing":
          return "支付 / 订单问题";
        default:
          return "其他";
      }
    }
    switch (t) {
      case "bug":
        return "Bug / issue";
      case "feature":
        return "Feature request";
      case "billing":
        return "Billing / order";
      default:
        return "Other";
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isAdmin = window.localStorage.getItem("isAdmin");
      const email = window.localStorage.getItem("adminEmail");
      const storedAvatar = window.localStorage.getItem("adminAvatarUrl");
      const storedRole = window.localStorage.getItem("adminRole");

      const authed = isAdmin === "true" && !!email;
      setIsAuthed(authed);
      setAdminEmail(email || null);
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

  const refreshUnreadFeedback = async (email: string | null) => {
    if (!email) return;
    try {
      const params = new URLSearchParams({
        adminEmail: email,
        status: "unread",
      });
      const res = await fetch(`/api/admin/feedback?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as { unreadCount?: number };
      setFeedbackBadge(
        typeof data.unreadCount === "number" ? data.unreadCount : 0
      );
    } catch {
      // 未读角标失败不影响其它功能
    }
  };

  // 定期轮询刷新未读反馈角标（每 10 秒）
  useEffect(() => {
    if (!adminEmail) return;

    // 首次加载
    refreshUnreadFeedback(adminEmail);

    // 轮询刷新未读数量
    const timer = window.setInterval(() => {
      refreshUnreadFeedback(adminEmail);
    }, 10000);

    // 当标签页重新获得可见性时，立即刷新一次
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshUnreadFeedback(adminEmail);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [adminEmail]);

  // 当反馈面板打开时，轮询刷新工单列表（每 5 秒）
  useEffect(() => {
    if (!adminEmail || !feedbackOpen) return;

    // 轮询刷新工单列表
    const pollFeedback = async () => {
      try {
        const params = new URLSearchParams({
          adminEmail,
          status: "all",
        });
        const res = await fetch(`/api/admin/feedback?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          items?: FeedbackItem[];
          unreadCount?: number;
        };
        setFeedbackItems(data.items ?? []);
        setFeedbackBadge(
          typeof data.unreadCount === "number" ? data.unreadCount : 0
        );
      } catch {
        // 轮询失败不影响其它功能
      }
    };

    const timer = window.setInterval(pollFeedback, 5000);

    // 当标签页重新获得可见性时，立即刷新一次
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void pollFeedback();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [adminEmail, feedbackOpen]);

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
          <h1>{messages.layout.unauthTitle}</h1>
          <p>{messages.layout.unauthDesc}</p>
          <p style={{ marginTop: 12 }}>
            <Link href="/admin/login">{messages.layout.unauthLoginLink}</Link>
          </p>
        </div>
      </div>
    );
  }

  const loadFeedbackList = async () => {
    if (!adminEmail) return;
    setFeedbackLoading(true);
    setFeedbackError("");
    try {
      const params = new URLSearchParams({
        adminEmail,
        status: "all",
      });
      const res = await fetch(`/api/admin/feedback?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "获取用户反馈失败");
      }
      const data = (await res.json()) as {
        items?: FeedbackItem[];
        unreadCount?: number;
      };
      setFeedbackItems(data.items ?? []);
      setFeedbackBadge(
        typeof data.unreadCount === "number" ? data.unreadCount : 0
      );

      // 打开列表时，将全部未读标记为已读，清空角标
      if (data.unreadCount && data.unreadCount > 0) {
        await fetch("/api/admin/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adminEmail,
            action: "mark-all-read",
          }),
        }).catch(() => {
          // 标记已读失败可以忽略，不影响列表展示
        });
        setFeedbackBadge(0);
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "获取用户反馈失败，请稍后重试。";
      setFeedbackError(message);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!adminEmail || replyTargetId == null) return;
    const text = replyContent.trim();
    if (!text) {
      setFeedbackError(
        language === "zh-CN"
          ? "请先填写回复内容"
          : "Please enter a reply message."
      );
      return;
    }

    setReplySubmitting(true);
    setFeedbackError("");
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail,
          action: "reply",
          feedbackId: replyTargetId,
          content: text,
        }),
      });
      if (!res.ok) {
        const textRes = await res.text();
        throw new Error(textRes || "回复失败，请稍后重试。");
      }

      setReplyContent("");
      setReplyTargetId(null);
      await loadFeedbackList();
    } catch (e) {
      setFeedbackError(
        e instanceof Error
          ? e.message
          : language === "zh-CN"
            ? "回复失败，请稍后重试。"
            : "Failed to send reply. Please try again later."
      );
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleCloseTicket = async (feedbackId: number) => {
    if (!adminEmail) return;
    // 简单确认，避免误操作
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      language === "zh-CN"
        ? "确定要关闭该工单吗？关闭后将无法继续回复。"
        : "Are you sure you want to close this ticket? You won't be able to reply afterwards."
    );
    if (!ok) return;

    setFeedbackError("");
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail,
          action: "close",
          feedbackId,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "关闭工单失败");
      }
      await loadFeedbackList();
    } catch (e) {
      setFeedbackError(
        e instanceof Error
          ? e.message
          : language === "zh-CN"
            ? "关闭工单失败，请稍后重试。"
            : "Failed to close ticket. Please try again later."
      );
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

        <div className="admin-layout__right">
          <main className="admin-layout__main">
            {/* 右侧顶部横向工具栏：搜索 + 快捷操作 + 用户头像 */}
            <div className="admin-layout__logout">
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
                  <div className="admin-topbar__feedback-wrapper">
                    <button
                      type="button"
                      className="admin-topbar__icon-btn"
                      aria-label={
                        language === "zh-CN" ? "用户反馈通知" : "User feedback"
                      }
                      onClick={async () => {
                        const nextOpen = !feedbackOpen;
                        setFeedbackOpen(nextOpen);
                        if (nextOpen) {
                          await loadFeedbackList();
                        }
                      }}
                    >
                      🔔
                      {feedbackBadge > 0 && (
                        <span className="admin-topbar__badge">
                          {feedbackBadge > 9 ? "9+" : feedbackBadge}
                        </span>
                      )}
                    </button>
                    {feedbackOpen && (
                      <div className="admin-topbar__feedback-panel">
                        <div className="admin-topbar__feedback-header">
                          <span>
                            {language === "zh-CN" ? "用户反馈" : "User feedback"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setFeedbackOpen(false)}
                            className="admin-topbar__feedback-close"
                            aria-label={
                              language === "zh-CN" ? "关闭反馈列表" : "Close"
                            }
                          >
                            ×
                          </button>
                        </div>
                        <div className="admin-topbar__feedback-body">
                          {feedbackLoading && (
                            <p className="admin-topbar__feedback-meta">
                              {messages.common.loading}
                            </p>
                          )}
                          {feedbackError && !feedbackLoading && (
                            <p
                              className="admin-topbar__feedback-meta"
                              style={{ color: "#f87171" }}
                            >
                              {feedbackError}
                            </p>
                          )}
                          {!feedbackLoading &&
                            !feedbackError &&
                            feedbackItems.length === 0 && (
                              <p className="admin-topbar__feedback-meta">
                                {language === "zh-CN"
                                  ? "目前还没有新的用户反馈。"
                                  : "No feedback yet."}
                              </p>
                            )}
                          {!feedbackLoading &&
                            !feedbackError &&
                            feedbackItems.length > 0 && (
                              <ul className="admin-topbar__feedback-list">
                                {feedbackItems.map((fb) => (
                                  <li
                                    key={fb.id}
                                    className="admin-topbar__feedback-item"
                                  >
                                    <div className="admin-topbar__feedback-header">
                                      <div className="admin-topbar__feedback-id">
                                        {language === "zh-CN"
                                          ? `工单 #${fb.id}`
                                          : `Ticket #${fb.id}`}
                                      </div>
                                      <div className="admin-topbar__feedback-status">
                                        <span
                                          className={
                                            fb.status === "closed"
                                              ? "admin-topbar__feedback-status-pill admin-topbar__feedback-status-pill--closed"
                                              : fb.status === "unread"
                                                ? "admin-topbar__feedback-status-pill admin-topbar__feedback-status-pill--open"
                                                : "admin-topbar__feedback-status-pill admin-topbar__feedback-status-pill--resolved"
                                          }
                                        >
                                          {language === "zh-CN"
                                            ? fb.status === "closed"
                                              ? "已关闭"
                                              : fb.status === "unread"
                                                ? "待处理"
                                                : "已处理"
                                            : fb.status === "closed"
                                              ? "Closed"
                                              : fb.status === "unread"
                                                ? "Open"
                                                : "Resolved"}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="admin-topbar__feedback-meta">
                                      <span>
                                        {renderTypeLabel(fb.type)}
                                      </span>
                                    </div>
                                    <div className="admin-topbar__feedback-email">
                                      {fb.userEmail}
                                    </div>
                                    <div className="admin-topbar__feedback-content">
                                      {fb.content}
                                    </div>
                                    <div className="admin-topbar__feedback-time">
                                      {new Date(
                                        fb.createdAt
                                      ).toLocaleString()}
                                    </div>
                                    <div className="admin-topbar__feedback-meta">
                                      {fb.latestReplyAdminEmail ? (
                                        <span>
                                          {language === "zh-CN"
                                            ? "已回复："
                                            : "Replied by "}
                                          {fb.latestReplyAdminEmail}
                                        </span>
                                      ) : (
                                        <span>
                                          {language === "zh-CN"
                                            ? "尚未回复"
                                            : "Not replied yet"}
                                        </span>
                                      )}
                                    </div>
                                    {fb.latestReplyContent && (
                                      <div className="admin-topbar__feedback-meta">
                                        {language === "zh-CN"
                                          ? `回复内容：${fb.latestReplyContent}`
                                          : `Reply: ${fb.latestReplyContent}`}
                                      </div>
                                    )}
                                    <div className="admin-topbar__feedback-reply-row">
                                      {fb.status === "closed" ? (
                                        <span className="admin-topbar__feedback-meta">
                                          {language === "zh-CN"
                                            ? "工单已关闭"
                                            : "Ticket closed"}
                                        </span>
                                      ) : replyTargetId === fb.id ? (
                                        <div className="admin-topbar__feedback-reply-box">
                                          <textarea
                                            value={replyContent}
                                            onChange={(e) =>
                                              setReplyContent(e.target.value)
                                            }
                                            placeholder={
                                              language === "zh-CN"
                                                ? "输入回复内容，用户将在下次登录时查看。"
                                                : "Enter your reply. The user will see it next time they log in."
                                            }
                                          />
                                          <div className="admin-topbar__feedback-reply-actions">
                                            <button
                                              type="button"
                                              onClick={handleSubmitReply}
                                              disabled={replySubmitting}
                                            >
                                              {replySubmitting
                                                ? language === "zh-CN"
                                                  ? "发送中..."
                                                  : "Sending..."
                                                : language === "zh-CN"
                                                  ? "发送回复"
                                                  : "Send"}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setReplyTargetId(null);
                                                setReplyContent("");
                                              }}
                                              disabled={replySubmitting}
                                            >
                                              {language === "zh-CN"
                                                ? "取消"
                                                : "Cancel"}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="admin-topbar__feedback-reply-actions">
                                          <button
                                            type="button"
                                            className="admin-topbar__feedback-reply-btn"
                                            onClick={() => {
                                              setReplyTargetId(fb.id);
                                              setReplyContent("");
                                            }}
                                          >
                                            {language === "zh-CN"
                                              ? "回复"
                                              : "Reply"}
                                          </button>
                                          <button
                                            type="button"
                                            className="admin-topbar__feedback-reply-btn admin-topbar__feedback-reply-btn--danger"
                                            onClick={() => handleCloseTicket(fb.id)}
                                          >
                                            {language === "zh-CN"
                                              ? "关闭工单"
                                              : "Close"}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
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

            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

