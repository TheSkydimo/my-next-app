"use client";

import { useEffect, useState } from "react";
import type { AppLanguage, AppTheme } from "../../client-prefs";
import { getInitialLanguage, getInitialTheme } from "../../client-prefs";
import { getUserMessages } from "../../user-i18n";
import { useUser } from "../../contexts/UserContext";

type FeedbackItem = {
  id: number;
  type?: string | null;
  content: string;
  status: string;
  createdAt: string;
  readAt: string | null;
  latestReplyAt: string | null;
  latestReplyAdminEmail: string | null;
  latestReplyContent: string | null;
   closedAt: string | null;
};

type TicketMessage = {
  id: string | number;
  sender: "user" | "admin";
  content: string;
  createdAt: string;
};

export default function UserFeedbackPage() {
  // 使用 UserContext 获取预加载的用户信息
  const userContext = useUser();
  const userEmail = userContext.profile?.email ?? null;
  const isUserInitialized = userContext.initialized;

  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [history, setHistory] = useState<FeedbackItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewTab, setViewTab] = useState<"new" | "history">("new");
  const [feedbackType, setFeedbackType] = useState<string>("other");
  const [historyOpenByType, setHistoryOpenByType] = useState<
    Record<string, boolean>
  >({});
  const [historyOpenByTicketId, setHistoryOpenByTicketId] = useState<
    Record<number, boolean>
  >({});
  const [activeMessages, setActiveMessages] = useState<TicketMessage[] | null>(
    null
  );
  const [loadingActiveMessages, setLoadingActiveMessages] = useState(false);
  const [activeMessageError, setActiveMessageError] = useState("");
  // 历史工单的完整对话记录（按工单 ID 存储）
  const [historyMessagesById, setHistoryMessagesById] = useState<
    Record<number, TicketMessage[]>
  >({});
  const [loadingHistoryMessagesById, setLoadingHistoryMessagesById] = useState<
    Record<number, boolean>
  >({});
  const [replyContent, setReplyContent] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  // 删除历史工单相关状态
  const [deletingTicketId, setDeletingTicketId] = useState<number | null>(null);

  // 主题相关颜色
  const isLight = theme === "light";
  const colors = {
    // 卡片/区块背景
    cardBg: isLight ? "#ffffff" : "#020617",
    // 边框
    border: isLight ? "#e5e7eb" : "#1f2937",
    borderLight: isLight ? "rgba(209,213,219,0.8)" : "rgba(55,65,81,0.8)",
    // 主文字
    text: isLight ? "#111827" : "#e5e7eb",
    // 次级文字
    textMuted: isLight ? "#6b7280" : "#9ca3af",
    textDim: isLight ? "#9ca3af" : "#6b7280",
    // 输入框背景
    inputBg: isLight ? "#f9fafb" : "#020617",
    inputBorder: isLight ? "#d1d5db" : "#4b5563",
    // 按钮背景
    btnSecondaryBg: isLight ? "#f3f4f6" : "#111827",
    btnSecondaryBorder: isLight ? "#d1d5db" : "#d1d5db",
    // 消息气泡（非用户）
    msgBubbleBg: isLight
      ? "linear-gradient(135deg, #f3f4f6, #e5e7eb)"
      : "linear-gradient(135deg, #020617, #111827)",
    msgBubbleBorder: isLight ? "#d1d5db" : "#374151",
    msgBubbleShadow: isLight
      ? "0 4px 12px rgba(0,0,0,0.08)"
      : "0 8px 18px rgba(15,23,42,0.7)",
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initialLang = getInitialLanguage();
    setLanguage(initialLang);
    const initialTheme = getInitialTheme();
    setTheme(initialTheme);

    const langHandler = (event: Event) => {
      const custom = event as CustomEvent<{ language: AppLanguage }>;
      if (custom.detail?.language) {
        setLanguage(custom.detail.language);
      }
    };

    // 监听主题变化
    const themeHandler = () => {
      const currentTheme = document.documentElement.dataset.theme as AppTheme;
      if (currentTheme === "light" || currentTheme === "dark") {
        setTheme(currentTheme);
      }
    };

    window.addEventListener("app-language-changed", langHandler as EventListener);

    // 使用 MutationObserver 监听 data-theme 变化
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-theme"
        ) {
          themeHandler();
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });

    return () => {
      window.removeEventListener(
        "app-language-changed",
        langHandler as EventListener
      );
      observer.disconnect();
    };
  }, []);

  const isClosedTicket = (item: FeedbackItem) =>
    item.status === "closed" || item.closedAt !== null;

  // 当前未关闭工单（同一时间最多一个，若存在多条历史数据则取最新一条）
  const openTickets = history.filter((item) => !isClosedTicket(item));
  const activeTicket =
    openTickets.length > 0 ? openTickets[openTickets.length - 1] : null;

  // 仅用于历史视图展示的已关闭工单
  const closedTickets = history.filter(isClosedTicket);

  // 预计算历史工单按类型分组（历史视图中仅展示已关闭工单）
  const historyGroupedByType: [string, FeedbackItem[]][] = (() => {
    const grouped: Record<string, FeedbackItem[]> = {};
    closedTickets.forEach((item) => {
      const key = item.type ?? "other";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return Object.entries(grouped);
  })();

  // 根据 URL hash 决定当前显示“提交反馈”还是“历史工单”，保持与左侧子菜单行为一致
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromHash = () => {
      const hash = window.location.hash;
      if (hash === "#feedback-history-section") {
        setViewTab("history");
      } else {
        setViewTab("new");
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, []);

  // 监听来自左侧“意见反馈”子菜单的切换事件，确保能够正确联动视图
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ section: "new" | "history" }>;
      const section = custom.detail?.section;
      if (section === "history") {
        setViewTab("history");
        if (window.location.hash !== "#feedback-history-section") {
          window.location.hash = "#feedback-history-section";
        }
      } else if (section === "new") {
        setViewTab("new");
        if (window.location.hash !== "#feedback-new-section") {
          window.location.hash = "#feedback-new-section";
        }
      }
    };

    window.addEventListener(
      "user-feedback-section-changed",
      handler as EventListener
    );
    return () => {
      window.removeEventListener(
        "user-feedback-section-changed",
        handler as EventListener
      );
    };
  }, []);

  const messages = getUserMessages(language);

  const typeOptions: { value: string; labelZh: string; labelEn: string }[] = [
    { value: "bug", labelZh: "功能异常 / Bug", labelEn: "Bug / issue" },
    { value: "feature", labelZh: "功能建议", labelEn: "Feature request" },
    { value: "billing", labelZh: "支付 / 订单问题", labelEn: "Billing / order" },
    { value: "other", labelZh: "其他", labelEn: "Other" },
  ];

  const renderTypeLabel = (rawType?: string | null) => {
    const t = rawType || "other";
    const found = typeOptions.find((o) => o.value === t) ?? typeOptions.at(-1)!;
    return language === "zh-CN" ? found.labelZh : found.labelEn;
  };

  const renderStatusLabel = (item: FeedbackItem) => {
    const isClosed = item.status === "closed" || item.closedAt !== null;
    if (language === "zh-CN") {
      if (isClosed) return "已关闭";
      if (item.status === "unread") return "待处理";
      return "已处理";
    }
    if (isClosed) return "Closed";
    if (item.status === "unread") return "Open";
    return "Resolved";
  };
  const TicketCard = ({
    item,
    isOpen,
    onToggle,
    onDelete,
    isDeleting,
  }: {
    item: FeedbackItem;
    isOpen: boolean;
    onToggle: () => void;
    onDelete?: () => void;
    isDeleting?: boolean;
  }) => {
    const time = new Date(item.createdAt).toLocaleString();
    const isClosed = item.status === "closed" || item.closedAt !== null;
    const isUnread = item.status === "unread";
    const statusLabel = renderStatusLabel(item);
    const typeLabel = renderTypeLabel(item.type);

    // 获取该工单的完整对话记录
    const ticketMessages = historyMessagesById[item.id];
    const isLoadingMessages = loadingHistoryMessagesById[item.id] ?? false;

    // 当展开且还没有加载过消息时，触发加载
    useEffect(() => {
      if (isOpen && !ticketMessages && !isLoadingMessages && userEmail) {
        void loadHistoryMessages(userEmail, item.id);
      }
    }, [isOpen, ticketMessages, isLoadingMessages, item.id]);

    return (
      <div
        key={item.id}
        style={{
          fontSize: 13,
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          padding: 8,
          backgroundColor: colors.cardBg,
          opacity: isClosed ? 0.8 : 1,
        }}
      >
        {/* 工单头部信息 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: isOpen ? 6 : 0,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: colors.textMuted,
            }}
          >
            {language === "zh-CN" ? "工单编号" : "Ticket ID"} #{item.id}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 9999,
                border: `1px solid ${colors.borderLight}`,
                backgroundColor: colors.cardBg,
                color: colors.text,
                maxWidth: 160,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={typeLabel}
            >
              {typeLabel}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 9999,
                border: isClosed
                  ? "1px solid rgba(148,163,184,0.6)"
                  : isUnread
                    ? "1px solid rgba(251,191,36,0.6)"
                    : "1px solid rgba(52,211,153,0.5)",
                backgroundColor: isClosed
                  ? "rgba(148,163,184,0.1)"
                  : isUnread
                    ? "rgba(251,191,36,0.08)"
                    : "rgba(16,185,129,0.08)",
                color: isClosed ? "#9ca3af" : isUnread ? "#fbbf24" : "#6ee7b7",
              }}
            >
              {statusLabel}
            </span>
            <span
              style={{
                fontSize: 11,
                color: colors.textDim,
              }}
            >
              {time}
            </span>
            <button
              type="button"
              onClick={onToggle}
              style={{
                marginLeft: 4,
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 9999,
                border: `1px solid ${colors.borderLight}`,
                backgroundColor: colors.cardBg,
                color: colors.text,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {language === "zh-CN"
                ? isOpen
                  ? "收起对话"
                  : "展开对话"
                : isOpen
                  ? "Hide"
                  : "Show"}
            </button>
            {/* 只对已关闭的工单显示删除按钮 */}
            {isClosed && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                style={{
                  marginLeft: 4,
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 9999,
                  border: "1px solid rgba(239,68,68,0.5)",
                  backgroundColor: "rgba(239,68,68,0.1)",
                  color: "#f87171",
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  opacity: isDeleting ? 0.6 : 1,
                }}
              >
                {isDeleting
                  ? language === "zh-CN"
                    ? "删除中..."
                    : "Deleting..."
                  : language === "zh-CN"
                    ? "删除"
                    : "Delete"}
              </button>
            )}
          </div>
        </div>
        {isOpen && (
          <>
            {isLoadingMessages ? (
              <p
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: colors.textMuted,
                }}
              >
                {language === "zh-CN" ? "加载对话中..." : "Loading..."}
              </p>
            ) : ticketMessages && ticketMessages.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 6,
                  maxHeight: 260,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                {ticketMessages.map((msg) => {
                  const isUser = msg.sender === "user";
                  const msgTime = new Date(msg.createdAt).toLocaleString();
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        justifyContent: isUser ? "flex-end" : "flex-start",
                      }}
                    >
                      <div style={{ maxWidth: "75%" }}>
                        <div
                          style={{
                            fontSize: 11,
                            color: colors.textMuted,
                            marginBottom: 2,
                            textAlign: isUser ? "right" : "left",
                          }}
                        >
                          {isUser
                            ? language === "zh-CN"
                              ? "我"
                              : "Me"
                            : language === "zh-CN"
                              ? "技术"
                              : "Support"}
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 10,
                              color: colors.textDim,
                            }}
                          >
                            {msgTime}
                          </span>
                        </div>
                        <div
                          style={{
                            padding: "6px 10px",
                            borderRadius: 12,
                            border: isUser
                              ? "1px solid rgba(96,165,250,0.8)"
                              : `1px solid ${colors.msgBubbleBorder}`,
                            background: isUser
                              ? "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(37,99,235,0.95))"
                              : colors.msgBubbleBg,
                            color: isUser ? "#f9fafb" : colors.text,
                            boxShadow: isUser
                              ? "0 8px 20px rgba(15,23,42,0.6)"
                              : colors.msgBubbleShadow,
                            wordBreak: "break-word",
                            fontSize: 12,
                          }}
                        >
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: colors.textMuted,
                }}
              >
                {language === "zh-CN"
                  ? "暂无对话记录。"
                  : "No conversation messages."}
              </p>
            )}
          </>
        )}
      </div>
    );
  };

  const loadHistory = async (email: string, isPolling = false) => {
    // 轮询时不显示 loading 状态，避免闪烁
    if (!isPolling) {
      setLoadingHistory(true);
    }
    try {
      const params = new URLSearchParams({ email });
      const res = await fetch(`/api/user/feedback?${params.toString()}`);
      if (!res.ok) {
        // 历史反馈加载失败不阻塞提交功能
        return;
      }
      const data = (await res.json()) as { items?: FeedbackItem[] };
      const newItems = data.items ?? [];

      // 只有当数据真正变化时才更新状态，避免闪烁
      setHistory((prev) => {
        if (prev.length !== newItems.length) return newItems;
        // 比较第一个和最后一个工单来判断是否有变化
        const prevFirstId = prev[0]?.id;
        const newFirstId = newItems[0]?.id;
        const prevLastId = prev[prev.length - 1]?.id;
        const newLastId = newItems[newItems.length - 1]?.id;
        if (prevFirstId !== newFirstId || prevLastId !== newLastId)
          return newItems;
        // 检查状态变化
        const hasChange = prev.some((item, idx) => {
          const newItem = newItems[idx];
          return (
            newItem &&
            (item.status !== newItem.status ||
              item.latestReplyContent !== newItem.latestReplyContent)
          );
        });
        if (hasChange) return newItems;
        return prev;
      });
    } catch {
      // ignore
    } finally {
      if (!isPolling) {
        setLoadingHistory(false);
      }
    }
  };

  const loadActiveMessages = async (
    email: string,
    feedbackId: number,
    isPolling = false
  ) => {
    // 轮询时不显示 loading 状态，避免闪烁
    if (!isPolling) {
      setLoadingActiveMessages(true);
    }
    setActiveMessageError("");
    try {
      const params = new URLSearchParams({
        email,
        feedbackId: String(feedbackId),
      });
      const res = await fetch(
        `/api/user/feedback/messages?${params.toString()}`
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "加载对话失败");
      }
      const data = (await res.json()) as { items?: TicketMessage[] };
      const newMessages = data.items ?? [];

      // 只有当数据真正变化时才更新状态，避免闪烁
      setActiveMessages((prev) => {
        if (!prev) return newMessages;
        if (prev.length !== newMessages.length) return newMessages;
        // 比较最后一条消息的 ID 来判断是否有新消息
        const prevLastId = prev[prev.length - 1]?.id;
        const newLastId = newMessages[newMessages.length - 1]?.id;
        if (prevLastId !== newLastId) return newMessages;
        return prev;
      });
    } catch (e) {
      if (!isPolling) {
        setActiveMessages(null);
        setActiveMessageError(
          e instanceof Error
            ? e.message
            : language === "zh-CN"
              ? "加载对话失败，请稍后再试。"
              : "Failed to load messages. Please try again later."
        );
      }
    } finally {
      if (!isPolling) {
        setLoadingActiveMessages(false);
      }
    }
  };

  // 删除历史工单
  const handleDeleteTicket = async (feedbackId: number) => {
    if (!userEmail) return;

    const confirmMsg =
      language === "zh-CN"
        ? "确定要删除该工单吗？删除后将无法恢复。"
        : "Are you sure you want to delete this ticket? This action cannot be undone.";
    if (!window.confirm(confirmMsg)) return;

    setDeletingTicketId(feedbackId);
    try {
      const res = await fetch("/api/user/feedback", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          feedbackId,
        }),
      });
      if (!res.ok) {
        const textRes = await res.text();
        throw new Error(
          textRes ||
            (language === "zh-CN"
              ? "删除工单失败，请稍后再试。"
              : "Failed to delete ticket. Please try again later.")
        );
      }

      // 删除成功后刷新列表
      void loadHistory(userEmail, true);
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : language === "zh-CN"
            ? "删除工单失败，请稍后再试。"
            : "Failed to delete ticket. Please try again later."
      );
    } finally {
      setDeletingTicketId(null);
    }
  };

  // 加载历史工单的完整对话
  const loadHistoryMessages = async (email: string, feedbackId: number) => {
    setLoadingHistoryMessagesById((prev) => ({ ...prev, [feedbackId]: true }));
    try {
      const params = new URLSearchParams({
        email,
        feedbackId: String(feedbackId),
      });
      const res = await fetch(
        `/api/user/feedback/messages?${params.toString()}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { items?: TicketMessage[] };
      setHistoryMessagesById((prev) => ({
        ...prev,
        [feedbackId]: data.items ?? [],
      }));
    } catch {
      // 加载失败不阻塞展示
    } finally {
      setLoadingHistoryMessagesById((prev) => ({ ...prev, [feedbackId]: false }));
    }
  };

  useEffect(() => {
    if (!userEmail) return;
    if (typeof window === "undefined") return;

    // 首次加载（显示 loading）
    void loadHistory(userEmail, false);

    // 轮询刷新（静默刷新，不显示 loading）
    const poll = () => {
      void loadHistory(userEmail, true);
    };

    // 在查看"历史工单"时，加快轮询频率；其他情况下保持较低频率
    const intervalMs = viewTab === "history" ? 5000 : 15000;
    const timer = window.setInterval(poll, intervalMs);

    // 当标签页重新获得可见性时，立即刷新一次，避免必须手动刷新
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        poll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [userEmail, viewTab]);

  // 当有进行中工单时，加载该工单的完整对话，并启动轮询以实时获取新消息
  useEffect(() => {
    if (!userEmail || !activeTicket) {
      setActiveMessages(null);
      return;
    }

    // 首次加载（非轮询模式，显示 loading）
    void loadActiveMessages(userEmail, activeTicket.id, false);

    // 轮询刷新对话消息（每 5 秒，使用轮询模式避免闪烁）
    const pollMessages = () => {
      void loadActiveMessages(userEmail, activeTicket.id, true);
    };
    const timer = window.setInterval(pollMessages, 5000);

    // 当标签页重新获得可见性时，立即刷新一次
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        pollMessages();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [userEmail, activeTicket?.id]);

  const handleSubmit = async () => {
    if (!userEmail) return;
    if (!feedbackType) {
      setError(
        language === "zh-CN"
          ? "请先选择反馈类型"
          : "Please choose a feedback type."
      );
      setOkMsg("");
      return;
    }
    const text = content.trim();
    if (!text) {
      setError(
        language === "zh-CN"
          ? "请先填写要反馈的问题或建议"
          : "Please enter your feedback first."
      );
      setOkMsg("");
      return;
    }

    setSubmitting(true);
    setError("");
    setOkMsg("");
    try {
      const pagePath =
        typeof window !== "undefined" ? window.location.pathname : null;
      const res = await fetch("/api/user/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          content: text,
          pagePath,
          type: feedbackType,
        }),
      });
      if (!res.ok) {
        const textRes = await res.text();
        throw new Error(
          textRes ||
            (language === "zh-CN"
              ? "提交反馈失败，请稍后再试。"
              : "Failed to submit feedback. Please try again later.")
        );
      }
      setOkMsg(
        language === "zh-CN"
          ? "感谢你的反馈，我们会尽快处理。"
          : "Thank you for your feedback. We'll look into it soon."
      );
      setContent("");
      setFeedbackType("other");
      // 静默刷新工单列表
      if (userEmail) {
        void loadHistory(userEmail, true);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : language === "zh-CN"
            ? "提交反馈失败，请稍后再试。"
            : "Failed to submit feedback. Please try again later."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!userEmail || !activeTicket) return;
    const text = replyContent.trim();
    if (!text) {
      setActiveMessageError(
        language === "zh-CN"
          ? "请先填写要发送的消息内容"
          : "Please enter a message before sending."
      );
      return;
    }

    // 乐观更新：立即在界面显示消息
    const optimisticMessage: TicketMessage = {
      id: `temp-${Date.now()}`,
      sender: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setActiveMessages((prev) =>
      prev ? [...prev, optimisticMessage] : [optimisticMessage]
    );
    setReplyContent("");
    setReplySubmitting(true);
    setActiveMessageError("");

    try {
      const res = await fetch("/api/user/feedback/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          feedbackId: activeTicket.id,
          content: text,
        }),
      });
      if (!res.ok) {
        const textRes = await res.text();
        throw new Error(
          textRes ||
            (language === "zh-CN"
              ? "发送消息失败，请稍后再试。"
              : "Failed to send message. Please try again later.")
        );
      }

      // 发送成功后静默刷新对话与工单状态
      if (userEmail) {
        void loadActiveMessages(userEmail, activeTicket.id, true);
        void loadHistory(userEmail, true);
      }
    } catch (e) {
      // 发送失败，移除乐观更新的消息
      setActiveMessages((prev) =>
        prev ? prev.filter((m) => m.id !== optimisticMessage.id) : null
      );
      setReplyContent(text); // 恢复输入内容
      setActiveMessageError(
        e instanceof Error
          ? e.message
          : language === "zh-CN"
            ? "发送消息失败，请稍后再试。"
            : "Failed to send message. Please try again later."
      );
    } finally {
      setReplySubmitting(false);
    }
  };

  // 等待 UserContext 初始化完成再判断登录状态
  if (!isUserInitialized) {
    return (
      <div className="vben-page">
        <p>{messages.common.loading}</p>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="vben-page">
        <p>{messages.common.loginRequired}</p>
      </div>
    );
  }

  // 根据当前视图动态获取标题和描述
  const getPageTitle = () => {
    if (viewTab === "history") {
      return language === "zh-CN" ? "历史工单" : "Ticket History";
    }
    // viewTab === "new"
    if (activeTicket) {
      return language === "zh-CN" ? "当前工单" : "Current Ticket";
    }
    return language === "zh-CN" ? "新建反馈" : "New Feedback";
  };

  const getPageSubtitle = () => {
    if (viewTab === "history") {
      return language === "zh-CN"
        ? "查看已关闭的历史反馈工单记录。"
        : "View your closed feedback ticket history.";
    }
    // viewTab === "new"
    if (activeTicket) {
      return language === "zh-CN"
        ? "继续与我们沟通，查看回复或补充信息。"
        : "Continue the conversation, view replies or add more details.";
    }
    return language === "zh-CN"
      ? "请选择反馈类型并描述您的问题或建议。"
      : "Please select a feedback type and describe your issue or suggestion.";
  };

  return (
    <div className="vben-page">
      <div className="vben-page__header">
        <h1 className="vben-page__title">{getPageTitle()}</h1>
        <p className="vben-page__subtitle">{getPageSubtitle()}</p>
      </div>

      {/* 根据当前子菜单只展示对应内容 */}
      {viewTab === "history" && (
        <section
          id="feedback-history-section"
          style={{
            marginTop: 20,
            padding: 8,
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.cardBg,
          }}
        >
          <h2 style={{ fontSize: 16, color: colors.text }}>
            {language === "zh-CN" ? "历史工单" : "History tickets"}
          </h2>
          {loadingHistory ? (
            <p style={{ marginTop: 8, fontSize: 13, color: colors.textMuted }}>
              {messages.common.loading}
            </p>
          ) : closedTickets.length === 0 ? (
            <p style={{ marginTop: 8, fontSize: 13, color: colors.textMuted }}>
              {language === "zh-CN"
                ? "暂无历史工单记录。"
                : "No history tickets yet."}
            </p>
          ) : (
            <>
              {historyGroupedByType.map(([typeKey, tickets]) => {
                const isOpen = historyOpenByType[typeKey] ?? false;
                const label = renderTypeLabel(typeKey);
                return (
                  <div key={typeKey} style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setHistoryOpenByType((prev) => ({
                          ...prev,
                          [typeKey]: !isOpen,
                        }))
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.cardBg,
                        color: colors.text,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <span>
                        {language === "zh-CN"
                          ? `${label}（${tickets.length}）`
                          : `${label} (${tickets.length})`}
                      </span>
                      <span style={{ fontSize: 11 }}>
                        {isOpen ? "▴" : "▾"}
                      </span>
                    </button>
                    {isOpen && (
                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {tickets.map((ticket) => {
                          const isTicketOpen =
                            historyOpenByTicketId[ticket.id] ?? false;
                          return (
                            <TicketCard
                              key={ticket.id}
                              item={ticket}
                              isOpen={isTicketOpen}
                              onToggle={() =>
                                setHistoryOpenByTicketId((prev) => ({
                                  ...prev,
                                  [ticket.id]: !isTicketOpen,
                                }))
                              }
                              onDelete={() => handleDeleteTicket(ticket.id)}
                              isDeleting={deletingTicketId === ticket.id}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </section>
      )}

      {viewTab === "new" && (
        <section
          id="feedback-new-section"
          style={{ marginTop: 20 }}
        >
          {okMsg && (
            <p style={{ marginTop: 8, color: "#4ade80", fontSize: 13 }}>
              {okMsg}
            </p>
          )}
          {error && (
            <p style={{ marginTop: 8, color: "red", fontSize: 13 }}>{error}</p>
          )}
          {activeTicket ? (
            (() => {
              const time = new Date(activeTicket.createdAt).toLocaleString();
              const isClosedActive = isClosedTicket(activeTicket);
              const isUnreadActive = activeTicket.status === "unread";
              const statusLabelActive = renderStatusLabel(activeTicket);
              const typeLabelActive = renderTypeLabel(activeTicket.type);

              return (
                <>
                  <p style={{ marginTop: 8, fontSize: 13, color: colors.textMuted }}>
                    {language === "zh-CN"
                      ? "你当前有一个正在处理中的工单，请在下方查看并补充说明。该工单关闭后，你可以再次提交新的反馈。"
                      : "You currently have an open ticket in progress. Please check the conversation below and add more details if needed. Once it is closed, you can submit a new ticket."}
                  </p>
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 12,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.cardBg,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: colors.textMuted,
                        }}
                      >
                        {language === "zh-CN" ? "工单编号" : "Ticket ID"} #
                        {activeTicket.id}
                      </div>
                      <div
                        style={{ display: "flex", gap: 6, alignItems: "center" }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 9999,
                            border: `1px solid ${colors.borderLight}`,
                            backgroundColor: colors.cardBg,
                            color: colors.text,
                            maxWidth: 160,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={typeLabelActive}
                        >
                          {typeLabelActive}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 9999,
                            border: isClosedActive
                              ? "1px solid rgba(148,163,184,0.6)"
                              : isUnreadActive
                                ? "1px solid rgba(251,191,36,0.6)"
                                : "1px solid rgba(52,211,153,0.5)",
                            backgroundColor: isClosedActive
                              ? "rgba(148,163,184,0.1)"
                              : isUnreadActive
                                ? "rgba(251,191,36,0.08)"
                                : "rgba(16,185,129,0.08)",
                            color: isClosedActive
                              ? "#9ca3af"
                              : isUnreadActive
                                ? "#fbbf24"
                                : "#6ee7b7",
                          }}
                        >
                          {statusLabelActive}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: colors.textDim,
                          }}
                        >
                          {time}
                        </span>
                      </div>
                    </div>

                    <h3
                      style={{
                        fontSize: 13,
                        marginBottom: 8,
                        color: colors.text,
                      }}
                    >
                      {language === "zh-CN" ? "对话记录" : "Conversation"}
                    </h3>
                    {loadingActiveMessages ? (
                      <p
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          color: colors.textMuted,
                        }}
                      >
                        {messages.common.loading}
                      </p>
                    ) : activeMessages && activeMessages.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          maxHeight: 260,
                          overflowY: "auto",
                          paddingRight: 4,
                        }}
                      >
                        {activeMessages.map((msg) => {
                          const isUser = msg.sender === "user";
                          const msgTime = new Date(
                            msg.createdAt
                          ).toLocaleString();
                          return (
                            <div
                              key={msg.id}
                              style={{
                                display: "flex",
                                justifyContent: isUser
                                  ? "flex-end"
                                  : "flex-start",
                              }}
                            >
                              <div style={{ maxWidth: "75%" }}>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: colors.textMuted,
                                    marginBottom: 2,
                                    textAlign: isUser ? "right" : "left",
                                  }}
                                >
                                  {isUser
                                    ? language === "zh-CN"
                                      ? "我"
                                      : "Me"
                                    : language === "zh-CN"
                                      ? "技术"
                                      : "Support"}
                                  <span
                                    style={{
                                      marginLeft: 6,
                                      fontSize: 10,
                                      color: colors.textDim,
                                    }}
                                  >
                                    {msgTime}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: 12,
                                    border: isUser
                                      ? "1px solid rgba(96,165,250,0.8)"
                                      : `1px solid ${colors.msgBubbleBorder}`,
                                    background: isUser
                                      ? "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(37,99,235,0.95))"
                                      : colors.msgBubbleBg,
                                    color: isUser ? "#f9fafb" : colors.text,
                                    boxShadow: isUser
                                      ? "0 8px 20px rgba(15,23,42,0.6)"
                                      : colors.msgBubbleShadow,
                                    wordBreak: "break-word",
                                    fontSize: 12,
                                  }}
                                >
                                  {msg.content}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          color: colors.textMuted,
                        }}
                      >
                        {language === "zh-CN"
                          ? "暂无更多对话记录。"
                          : "No conversation messages yet."}
                      </p>
                    )}
                    {activeMessageError && (
                      <p
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: "#f97373",
                        }}
                      >
                    {activeMessageError}
                  </p>
                )}
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={
                      language === "zh-CN"
                        ? "补充说明你的问题或回复技术支持..."
                        : "Add more details or reply to support..."
                    }
                    style={{
                      flex: 1,
                      minHeight: 80,
                      resize: "vertical",
                      padding: 8,
                      borderRadius: 8,
                      border: `1px solid ${colors.inputBorder}`,
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                      fontSize: 13,
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={replySubmitting}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 9999,
                      background:
                        "linear-gradient(90deg, rgba(96,165,250,0.95), rgba(79,70,229,0.95))",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      opacity: replySubmitting ? 0.7 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {replySubmitting
                      ? language === "zh-CN"
                        ? "发送中..."
                        : "Sending..."
                      : language === "zh-CN"
                        ? "发送消息"
                        : "Send message"}
                  </button>
                </div>
                  </div>
                </>
              );
            })()
          ) : (
            <>
              {/* 反馈类型选择 - 直接在输入框上方显示为可点击标签 */}
              <div style={{ marginTop: 12, marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {typeOptions.map((opt) => {
                    const isSelected = feedbackType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFeedbackType(opt.value)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 9999,
                          border: isSelected
                            ? "1px solid rgba(96,165,250,0.8)"
                            : `1px solid ${colors.inputBorder}`,
                          backgroundColor: isSelected
                            ? "rgba(59,130,246,0.15)"
                            : colors.inputBg,
                          color: isSelected ? "#60a5fa" : colors.text,
                          fontSize: 13,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {language === "zh-CN" ? opt.labelZh : opt.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    language === "zh-CN"
                      ? "请描述你遇到的问题，或写下你对产品的建议（例如：你是在哪个页面遇到问题、具体操作步骤等）。"
                      : "Describe the issue you encountered or any suggestions (for example: which page, what you did, etc.)."
                  }
                  style={{
                    width: "100%",
                    minHeight: 120,
                    resize: "vertical",
                    padding: 8,
                    borderRadius: 8,
                    border: `1px solid ${colors.inputBorder}`,
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    fontSize: 13,
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 9999,
                    background:
                      "linear-gradient(90deg, rgba(96,165,250,0.95), rgba(79,70,229,0.95))",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting
                    ? language === "zh-CN"
                      ? "提交中..."
                      : "Submitting..."
                    : language === "zh-CN"
                      ? "提交反馈"
                      : "Submit"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContent("");
                    setError("");
                    setOkMsg("");
                    setFeedbackType("other");
                  }}
                  disabled={submitting}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 9999,
                    border: `1px solid ${colors.btnSecondaryBorder}`,
                    backgroundColor: colors.btnSecondaryBg,
                    color: colors.text,
                    cursor: "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {language === "zh-CN" ? "清空" : "Reset"}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}


