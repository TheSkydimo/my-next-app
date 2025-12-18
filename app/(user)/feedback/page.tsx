"use client";

import { useEffect, useState } from "react";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getUserMessages } from "../../user-i18n";

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
  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [history, setHistory] = useState<FeedbackItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewTab, setViewTab] = useState<"new" | "history">("new");
  const [feedbackType, setFeedbackType] = useState<string>("bug");
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
  const [replyContent, setReplyContent] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initialLang = getInitialLanguage();
    setLanguage(initialLang);

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ language: AppLanguage }>;
      if (custom.detail?.language) {
        setLanguage(custom.detail.language);
      }
    };

    window.addEventListener("app-language-changed", handler as EventListener);
    return () => {
      window.removeEventListener(
        "app-language-changed",
        handler as EventListener
      );
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const email = window.localStorage.getItem("loggedInUserEmail");
    setUserEmail(email);
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
  }: {
    item: FeedbackItem;
    isOpen: boolean;
    onToggle: () => void;
  }) => {
    const time = new Date(item.createdAt).toLocaleString();
    const match = item.content.match(/^\[[^\]]+\]\s*(.*)$/);
    const myText = match && match[1] ? match[1].trim() : item.content;
    const isClosed = item.status === "closed" || item.closedAt !== null;
    const isUnread = item.status === "unread";
    const statusLabel = renderStatusLabel(item);
    const typeLabel = renderTypeLabel(item.type);

    return (
      <div
        key={item.id}
        style={{
          fontSize: 13,
          borderRadius: 12,
          border: "1px solid #1f2937",
          padding: 8,
          background:
            "radial-gradient(circle at top left, #020617, #020617 30%, #020617)",
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
              color: "#9ca3af",
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
                border: "1px solid rgba(55,65,81,0.8)",
                backgroundColor: "#020617",
                color: "#e5e7eb",
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
                color: "#6b7280",
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
                border: "1px solid rgba(55,65,81,0.8)",
                backgroundColor: "#020617",
                color: "#e5e7eb",
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
          </div>
        </div>
        {isOpen && (
          <>
            {/* 用户消息气泡（右侧） */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 6,
                marginBottom: 4,
              }}
            >
              <div style={{ maxWidth: "75%" }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    textAlign: "right",
                    marginBottom: 2,
                  }}
                >
                  {language === "zh-CN" ? "我" : "Me"}
                </div>
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(96,165,250,0.8)",
                    background:
                      "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(37,99,235,0.95))",
                    color: "#f9fafb",
                    boxShadow: "0 8px 20px rgba(15,23,42,0.6)",
                    wordBreak: "break-word",
                  }}
                >
                  {myText}
                </div>
              </div>
            </div>
            {/* 技术回复气泡（左侧，仅在有回复时显示） */}
            {item.latestReplyContent && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-start",
                }}
              >
                <div style={{ maxWidth: "75%" }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      marginBottom: 2,
                    }}
                  >
                    {language === "zh-CN" ? "技术" : "Support"}
                  </div>
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 12,
                      border: "1px solid #374151",
                      background:
                        "linear-gradient(135deg, #020617, #111827)",
                      color: "#e5e7eb",
                      boxShadow: "0 8px 18px rgba(15,23,42,0.7)",
                      wordBreak: "break-word",
                      fontSize: 12,
                    }}
                  >
                    {item.latestReplyContent}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const loadHistory = async (email: string) => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({ email });
      const res = await fetch(`/api/user/feedback?${params.toString()}`);
      if (!res.ok) {
        // 历史反馈加载失败不阻塞提交功能
        return;
      }
      const data = (await res.json()) as { items?: FeedbackItem[] };
      setHistory(data.items ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadActiveMessages = async (email: string, feedbackId: number) => {
    setLoadingActiveMessages(true);
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
      setActiveMessages(data.items ?? []);
    } catch (e) {
      setActiveMessages(null);
      setActiveMessageError(
        e instanceof Error
          ? e.message
          : language === "zh-CN"
            ? "加载对话失败，请稍后再试。"
            : "Failed to load messages. Please try again later."
      );
    } finally {
      setLoadingActiveMessages(false);
    }
  };

  useEffect(() => {
    if (!userEmail) return;
    if (typeof window === "undefined") return;

    const poll = () => {
      void loadHistory(userEmail);
    };

    // 首次进入页面或切换视图时，立即加载一次历史记录
    poll();

    // 在查看“历史工单”时，加快轮询频率；其他情况下保持较低频率
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

    // 首次加载
    void loadActiveMessages(userEmail, activeTicket.id);

    // 轮询刷新对话消息（每 5 秒）
    const pollMessages = () => {
      void loadActiveMessages(userEmail, activeTicket.id);
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
      setFeedbackType("bug");
      if (userEmail) {
        void loadHistory(userEmail);
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

      setReplyContent("");

      // 发送成功后刷新对话与工单状态
      if (userEmail) {
        void loadActiveMessages(userEmail, activeTicket.id);
        void loadHistory(userEmail);
      }
    } catch (e) {
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

  if (!userEmail) {
    return (
      <div style={{ maxWidth: 640, margin: "10px auto" }}>
        <p>{messages.common.loginRequired}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "10px auto" }}>
      <h1>{language === "zh-CN" ? "意见反馈" : "Feedback"}</h1>
      <p
        style={{
          marginTop: 8,
          fontSize: 14,
          color: "#9ca3af",
        }}
      >
        {language === "zh-CN"
          ? "如果在使用过程中遇到问题，或者有任何建议，欢迎在这里告诉我们。"
          : "If you encounter any problems or have suggestions, feel free to let us know here."}
      </p>

      {/* 根据当前子菜单只展示对应内容 */}
      {viewTab === "history" && (
        <section
          id="feedback-history-section"
          style={{
            marginTop: 20,
            padding: 8,
            borderRadius: 12,
            border: "1px solid #1f2937",
            backgroundColor: "#020617",
          }}
        >
          <h2 style={{ fontSize: 16 }}>
            {language === "zh-CN" ? "历史工单" : "History tickets"}
          </h2>
          {loadingHistory ? (
            <p style={{ marginTop: 8, fontSize: 13, color: "#9ca3af" }}>
              {messages.common.loading}
            </p>
          ) : closedTickets.length === 0 ? (
            <p style={{ marginTop: 8, fontSize: 13, color: "#9ca3af" }}>
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
                        border: "1px solid #1f2937",
                        backgroundColor: "#020617",
                        color: "#e5e7eb",
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
          <h2 style={{ fontSize: 16 }}>
            {language === "zh-CN" ? "提交新的反馈" : "Send new feedback"}
          </h2>
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
                  <p style={{ marginTop: 8, fontSize: 13, color: "#9ca3af" }}>
                    {language === "zh-CN"
                      ? "你当前有一个正在处理中的工单，请在下方查看并补充说明。该工单关闭后，你可以再次提交新的反馈。"
                      : "You currently have an open ticket in progress. Please check the conversation below and add more details if needed. Once it is closed, you can submit a new ticket."}
                  </p>
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid #1f2937",
                      backgroundColor: "#020617",
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
                          color: "#9ca3af",
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
                            border: "1px solid rgba(55,65,81,0.8)",
                            backgroundColor: "#020617",
                            color: "#e5e7eb",
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
                            color: "#6b7280",
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
                        color: "#e5e7eb",
                      }}
                    >
                      {language === "zh-CN" ? "对话记录" : "Conversation"}
                    </h3>
                    {loadingActiveMessages ? (
                      <p
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          color: "#9ca3af",
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
                                    color: "#9ca3af",
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
                                      color: "#6b7280",
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
                                      : "1px solid #374151",
                                    background: isUser
                                      ? "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(37,99,235,0.95))"
                                      : "linear-gradient(135deg, #020617, #111827)",
                                    color: isUser ? "#f9fafb" : "#e5e7eb",
                                    boxShadow: isUser
                                      ? "0 8px 20px rgba(15,23,42,0.6)"
                                      : "0 8px 18px rgba(15,23,42,0.7)",
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
                          color: "#9ca3af",
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
                      border: "1px solid #4b5563",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
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
              <div style={{ marginTop: 12 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    marginBottom: 4,
                    color: "#e5e7eb",
                  }}
                >
                  {language === "zh-CN" ? "反馈类型" : "Feedback type"}
                </label>
                <select
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid #4b5563",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                >
                  {typeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {language === "zh-CN" ? opt.labelZh : opt.labelEn}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginTop: 12 }}>
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
                    setFeedbackType("bug");
                  }}
                  disabled={submitting}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 9999,
                    border: "1px solid #d1d5db",
                    backgroundColor: "#111827",
                    color: "#e5e7eb",
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


