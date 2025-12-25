"use client";

import { useEffect, useState } from "react";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getAdminMessages } from "../../admin-i18n";
import { useAdmin } from "../../contexts/AdminContext";
import { useAutoDismissMessage } from "../../hooks/useAutoDismissMessage";

export default function AdminNotificationsPage() {
  const adminContext = useAdmin();
  const adminEmail = adminContext.profile?.email ?? null;

  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const messages = getAdminMessages(language);

  const [level, setLevel] = useState<"info" | "warn" | "critical">("info");
  const [type, setType] = useState("admin_message");
  const [titleZh, setTitleZh] = useState("");
  const [bodyZh, setBodyZh] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const [sending, setSending] = useState(false);
  const [error, setError] = useAutoDismissMessage(2500);
  const [okMsg, setOkMsg] = useAutoDismissMessage(2500);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ language: AppLanguage }>;
      if (custom.detail?.language) setLanguage(custom.detail.language);
    };
    window.addEventListener("app-language-changed", handler as EventListener);
    return () => window.removeEventListener("app-language-changed", handler as EventListener);
  }, []);

  const send = async () => {
    if (!adminEmail) return;
    setError("");
    setOkMsg("");

    if (!titleZh.trim() || !titleEn.trim()) {
      setError(messages.notifications.errorTitleRequired);
      return;
    }
    if (!bodyZh.trim() || !bodyEn.trim()) {
      setError(messages.notifications.errorBodyRequired);
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          type: type.trim() || "admin_message",
          titleZh: titleZh.trim(),
          bodyZh: bodyZh.trim(),
          titleEn: titleEn.trim(),
          bodyEn: bodyEn.trim(),
          linkUrl: linkUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.common.unknownError);
      }
      setOkMsg(messages.notifications.successSent);
      setTitleZh("");
      setBodyZh("");
      setTitleEn("");
      setBodyEn("");
      setLinkUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.common.unknownError);
    } finally {
      setSending(false);
    }
  };

  if (!adminEmail) {
    return (
      <div className="vben-page">
        <p>{messages.common.adminLoginRequired}</p>
      </div>
    );
  }

  return (
    <div className="vben-page">
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>{messages.notifications.title}</h1>
      <p style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
        {messages.notifications.desc}
      </p>

      {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}
      {okMsg && <p style={{ color: "green", marginTop: 12 }}>{okMsg}</p>}

      <section style={{ marginTop: 18, maxWidth: 720 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13 }}>
            <div style={{ color: "#111827", fontWeight: 600 }}>
              {messages.notifications.scopeLabel}
            </div>
            <div style={{ marginTop: 6, color: "#374151" }}>
              {messages.notifications.scopeValueAll}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, minWidth: 200 }}>
              {messages.notifications.levelLabel}
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as "info" | "warn" | "critical")}
                style={{ width: "100%", marginTop: 6 }}
              >
                <option value="info">{messages.notifications.levelInfo}</option>
                <option value="warn">{messages.notifications.levelWarn}</option>
                <option value="critical">{messages.notifications.levelCritical}</option>
              </select>
            </label>

            <label style={{ fontSize: 13, flex: 1, minWidth: 240 }}>
              {messages.notifications.typeLabel}
              <input
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="admin_message"
                style={{ width: "100%", marginTop: 6 }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, flex: 1, minWidth: 280 }}>
              {messages.notifications.titleZhLabel}
              <input
                value={titleZh}
                onChange={(e) => setTitleZh(e.target.value)}
                placeholder={messages.notifications.titleZhPlaceholder}
                style={{ width: "100%", marginTop: 6 }}
              />
            </label>
            <label style={{ fontSize: 13, flex: 1, minWidth: 280 }}>
              {messages.notifications.titleEnLabel}
              <input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder={messages.notifications.titleEnPlaceholder}
                style={{ width: "100%", marginTop: 6 }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, flex: 1, minWidth: 280 }}>
              {messages.notifications.bodyZhLabel}
              <textarea
                value={bodyZh}
                onChange={(e) => setBodyZh(e.target.value)}
                placeholder={messages.notifications.bodyZhPlaceholder}
                style={{ width: "100%", marginTop: 6, minHeight: 120, resize: "vertical" }}
              />
            </label>
            <label style={{ fontSize: 13, flex: 1, minWidth: 280 }}>
              {messages.notifications.bodyEnLabel}
              <textarea
                value={bodyEn}
                onChange={(e) => setBodyEn(e.target.value)}
                placeholder={messages.notifications.bodyEnPlaceholder}
                style={{ width: "100%", marginTop: 6, minHeight: 120, resize: "vertical" }}
              />
            </label>
          </div>

          <label style={{ fontSize: 13 }}>
            {messages.notifications.linkUrlLabel}
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={messages.notifications.linkUrlPlaceholder}
              style={{ width: "100%", marginTop: 6 }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button
              type="button"
              className="user-profile-button user-profile-button--primary user-profile-button--compact"
              onClick={() => void send()}
              disabled={sending}
            >
              {sending ? messages.common.loading : messages.notifications.sendButton}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}


