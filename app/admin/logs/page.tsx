"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getAdminMessages } from "../../admin-i18n";
import { useAdmin } from "../../contexts/AdminContext";

export default function AdminLogsPage() {
  const adminContext = useAdmin();
  const adminEmail = adminContext.profile?.email ?? null;

  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const messages = getAdminMessages(language);

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

  const logsUrl = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_ADMIN_LOGS_URL ?? "";
    return raw.trim();
  }, []);

  if (!adminEmail) {
    return (
      <div className="vben-page">
        <div className="vben-page__header">
          <h1 className="vben-page__title">{messages.logs.title}</h1>
        </div>
        <p>{messages.common.adminLoginRequired}</p>
        <Link href="/admin/login">{messages.common.goAdminLogin}</Link>
      </div>
    );
  }

  return (
    <div className="vben-page">
      <div className="vben-page__header">
        <div className="vben-row vben-row--between vben-row--center">
          <div>
            <h1 className="vben-page__title">{messages.logs.title}</h1>
            <p className="vben-page__subtitle">{messages.logs.desc}</p>
          </div>
          <Link href="/admin" className="btn btn-secondary btn-sm">
            {messages.orders.backToHome}
          </Link>
        </div>
      </div>

      <div className="vben-card">
        {logsUrl ? (
          <>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {messages.logs.urlLabel}
              </div>
              <div style={{ wordBreak: "break-all" }}>{logsUrl}</div>
            </div>

            <a
              className="btn btn-primary"
              href={logsUrl}
              target="_blank"
              rel="noreferrer"
            >
              {messages.logs.openLogs}
            </a>
          </>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>{messages.logs.urlNotConfigured}</p>
            <p style={{ opacity: 0.85 }}>{messages.logs.configureHint}</p>
          </>
        )}
      </div>
    </div>
  );
}


