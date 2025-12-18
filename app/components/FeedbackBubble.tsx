"use client";

import { useState, useRef, useEffect } from "react";
import type { AppLanguage, AppTheme } from "../client-prefs";
import { getInitialLanguage, getInitialTheme } from "../client-prefs";

type FeedbackBubbleMessages = {
  title: string;
  placeholder: string;
  send: string;
  sending: string;
  successTitle: string;
  successMessage: string;
  errorMessage: string;
};

const messages: Record<AppLanguage, FeedbackBubbleMessages> = {
  "zh-CN": {
    title: "快速反馈",
    placeholder: "请输入您的问题或建议...",
    send: "发送",
    sending: "发送中...",
    successTitle: "感谢您的反馈！",
    successMessage: "我们会尽快处理您的反馈。",
    errorMessage: "发送失败，请稍后再试",
  },
  "en-US": {
    title: "Quick Feedback",
    placeholder: "Enter your question or suggestion...",
    send: "Send",
    sending: "Sending...",
    successTitle: "Thank you for your feedback!",
    successMessage: "We will process your feedback as soon as possible.",
    errorMessage: "Failed to send, please try again later",
  },
};

export default function FeedbackBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [theme, setTheme] = useState<AppTheme>("dark");
  const panelRef = useRef<HTMLDivElement>(null);

  const msg = messages[language];
  const isLight = theme === "light";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initialLang = getInitialLanguage();
    setLanguage(initialLang);

    const initialTheme = getInitialTheme();
    setTheme(initialTheme);

    // 检查用户是否已登录
    const userEmail = window.localStorage.getItem("loggedInUserEmail");
    setIsLoggedIn(!!userEmail);

    // 监听语言切换事件
    const langHandler = (e: Event) => {
      const custom = e as CustomEvent<{ language: AppLanguage }>;
      if (custom.detail?.language) {
        setLanguage(custom.detail.language);
      }
    };

    // 监听主题切换事件
    const themeHandler = (e: Event) => {
      const custom = e as CustomEvent<{ theme: AppTheme }>;
      if (custom.detail?.theme) {
        setTheme(custom.detail.theme);
      }
    };

    window.addEventListener("app-language-changed", langHandler);
    window.addEventListener("app-theme-changed", themeHandler);

    return () => {
      window.removeEventListener("app-language-changed", langHandler);
      window.removeEventListener("app-theme-changed", themeHandler);
    };
  }, []);

  // 点击外部关闭面板
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSend = async () => {
    if (!content.trim()) return;

    setSending(true);
    setStatus("idle");
    setErrorMsg("");

    // 直接从 localStorage 读取用户邮箱，确保能获取到
    const userEmail = typeof window !== "undefined" 
      ? window.localStorage.getItem("loggedInUserEmail") 
      : null;

    try {
      const res = await fetch("/api/feedback/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          email: userEmail || undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || msg.errorMessage);
      }

      setStatus("success");
      setContent("");
      // 保留用户邮箱，不清空

      // 3秒后自动关闭成功提示
      setTimeout(() => {
        setStatus("idle");
        setIsOpen(false);
      }, 3000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : msg.errorMessage);
    } finally {
      setSending(false);
    }
  };

  const colors = {
    bubbleBg: isLight
      ? "linear-gradient(135deg, #3b82f6, #1d4ed8)"
      : "linear-gradient(135deg, #3b82f6, #6366f1)",
    panelBg: isLight ? "#ffffff" : "#0f172a",
    panelBorder: isLight ? "#e5e7eb" : "#334155",
    text: isLight ? "#111827" : "#e5e7eb",
    textMuted: isLight ? "#6b7280" : "#94a3b8",
    inputBg: isLight ? "#f9fafb" : "#1e293b",
    inputBorder: isLight ? "#d1d5db" : "#475569",
    btnBg: isLight
      ? "linear-gradient(135deg, #3b82f6, #1d4ed8)"
      : "linear-gradient(135deg, #3b82f6, #6366f1)",
    successBg: isLight
      ? "linear-gradient(135deg, #10b981, #059669)"
      : "linear-gradient(135deg, #10b981, #059669)",
    errorBg: isLight
      ? "linear-gradient(135deg, #ef4444, #dc2626)"
      : "linear-gradient(135deg, #ef4444, #dc2626)",
  };

  // 未登录用户不显示反馈气泡
  if (!isLoggedIn) {
    return null;
  }

  return (
    <>
      {/* 气泡按钮 */}
      <button
        type="button"
        className="feedback-bubble__trigger"
        onClick={() => {
          setIsOpen(!isOpen);
          setStatus("idle");
        }}
        style={{
          background: colors.bubbleBg,
        }}
        aria-label={msg.title}
      >
        {isOpen ? (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* 反馈面板 */}
      {isOpen && (
        <div
          ref={panelRef}
          className="feedback-bubble__panel"
          style={{
            background: colors.panelBg,
            borderColor: colors.panelBorder,
            color: colors.text,
          }}
        >
          {status === "success" ? (
            <div className="feedback-bubble__success">
              <div
                className="feedback-bubble__success-icon"
                style={{ background: colors.successBg }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h4 className="feedback-bubble__success-title">
                {msg.successTitle}
              </h4>
              <p
                className="feedback-bubble__success-message"
                style={{ color: colors.textMuted }}
              >
                {msg.successMessage}
              </p>
            </div>
          ) : (
            <>
              <div className="feedback-bubble__header">
                <h3 className="feedback-bubble__title">{msg.title}</h3>
                <button
                  type="button"
                  className="feedback-bubble__close"
                  onClick={() => setIsOpen(false)}
                  style={{ color: colors.textMuted }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="feedback-bubble__body">
                <textarea
                  className="feedback-bubble__textarea"
                  placeholder={msg.placeholder}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  style={{
                    background: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  }}
                  rows={4}
                />

                {status === "error" && (
                  <div
                    className="feedback-bubble__error"
                    style={{ color: "#ef4444" }}
                  >
                    {errorMsg}
                  </div>
                )}
              </div>

              <div className="feedback-bubble__footer">
                <button
                  type="button"
                  className="feedback-bubble__send"
                  onClick={handleSend}
                  disabled={sending || !content.trim()}
                  style={{
                    background: colors.btnBg,
                    opacity: sending || !content.trim() ? 0.6 : 1,
                  }}
                >
                  {sending ? msg.sending : msg.send}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

