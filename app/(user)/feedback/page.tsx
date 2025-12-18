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

  // 预计算历史工单按类型分组（历史视图中展示全部工单，状态由卡片上的状态标签区分）
  const historyGroupedByType: [string, FeedbackItem[]][] = (() => {
    const grouped: Record<string, FeedbackItem[]> = {};
    history.forEach((item) => {
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

  const renderTicketCard = (item: FeedbackItem) => {
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
            marginBottom: 6,
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
          </div>
        </div>
        {/* 用户消息气泡（右侧） */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
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

  useEffect(() => {
    if (!userEmail) return;

    // 首次进入页面立即加载一次历史记录
    void loadHistory(userEmail);

    // 简单轮询：在用户停留在该页期间，每隔 15 秒自动刷新一次历史反馈
    if (typeof window === "undefined") return;
    const timer = window.setInterval(() => {
      void loadHistory(userEmail);
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, [userEmail]);

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
          ) : history.length === 0 ? (
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
                        {tickets.map(renderTicketCard)}
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
        </section>
      )}
    </div>
  );
}


