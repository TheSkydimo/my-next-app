"use client";

import { useEffect, useState } from "react";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getUserMessages } from "../../user-i18n";

type FeedbackItem = {
  id: number;
  content: string;
  status: string;
  createdAt: string;
  readAt: string | null;
  latestReplyAt: string | null;
  latestReplyAdminEmail: string | null;
  latestReplyContent: string | null;
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const email = window.localStorage.getItem("loggedInUserEmail");
    setUserEmail(email);
  }, []);

  const messages = getUserMessages(language);

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
        body: JSON.stringify({ email: userEmail, content: text, pagePath }),
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

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 16 }}>
          {language === "zh-CN" ? "历史反馈" : "Feedback history"}
        </h2>
        {loadingHistory ? (
          <p style={{ marginTop: 8, fontSize: 14, color: "#9ca3af" }}>
            {messages.common.loading}
          </p>
        ) : history.length === 0 ? (
          <p style={{ marginTop: 8, fontSize: 14, color: "#9ca3af" }}>
            {language === "zh-CN"
              ? "你还没有提交过反馈。"
              : "You haven't submitted any feedback yet."}
          </p>
        ) : (
          <>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {history.map((item) => {
                const time = new Date(item.createdAt).toLocaleString();
                const match = item.content.match(/^\[[^\]]+\]\s*(.*)$/);
                const myText =
                  match && match[1] ? match[1].trim() : item.content;
                return (
                  <div key={item.id} style={{ fontSize: 13 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#9ca3af",
                        textAlign: "center",
                        marginBottom: 4,
                      }}
                    >
                      {time}
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
              })}
            </div>
            {/* 会话下方统一提醒文案 */}
            <p
              style={{
                marginTop: 12,
                fontSize: 12,
                color: "#9ca3af",
                textAlign: "center",
              }}
            >
              {language === "zh-CN"
                ? "感谢您的反馈，我们会尽快处理。"
                : "Thank you for your feedback. Our support team will handle it as soon as possible."}
            </p>
          </>
        )}
      </section>

      {error && (
        <p style={{ marginTop: 20, color: "red", fontSize: 14 }}>{error}</p>
      )}

      <section style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 16 }}>
          {language === "zh-CN" ? "提交新的反馈" : "Send new feedback"}
        </h2>
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
    </div>
  );
}


