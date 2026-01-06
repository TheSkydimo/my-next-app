"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AppLanguage, AppTheme } from "../../client-prefs";
import { getInitialLanguage, getInitialTheme } from "../../client-prefs";
import { getAdminMessages } from "../../admin-i18n";
import { useAdmin } from "../../contexts/AdminContext";
import { Button, Card, ConfigProvider, Space, Typography, Result, theme as antdTheme } from "antd";

export default function AdminLogsPage() {
  const adminContext = useAdmin();
  const adminEmail = adminContext.profile?.email ?? null;

  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getInitialTheme());
  const messages = getAdminMessages(language);

  useEffect(() => {
    if (typeof window === "undefined") return;

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

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ theme: AppTheme }>;
      if (custom.detail?.theme) {
        setAppTheme(custom.detail.theme);
      }
    };

    window.addEventListener("app-theme-changed", handler as EventListener);
    return () => {
      window.removeEventListener("app-theme-changed", handler as EventListener);
    };
  }, []);

  const themeConfig = useMemo(() => {
    return {
      algorithm: appTheme === "dark" ? antdTheme.darkAlgorithm : undefined,
    };
  }, [appTheme]);

  const logsUrl = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_ADMIN_LOGS_URL ?? "";
    return raw.trim();
  }, []);

  const issuesUrl = useMemo(() => {
    const fallback = "https://skydimo.sentry.io/issues/?statsPeriod=7d";
    const raw = process.env.NEXT_PUBLIC_ADMIN_SENTRY_ISSUES_URL ?? fallback;
    return raw.trim();
  }, []);

  if (!adminEmail) {
    return (
      <ConfigProvider theme={themeConfig}>
        <div className="vben-page">
          <Card style={{ maxWidth: 820 }}>
            <Result status="403" title={messages.common.adminLoginRequired} />
            <div style={{ marginTop: 12 }}>
              <Link href="/admin/login">{messages.common.goAdminLogin}</Link>
            </div>
          </Card>
        </div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={themeConfig}>
      <div className="vben-page">
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Space align="start" style={{ width: "100%", justifyContent: "space-between" }} wrap>
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {messages.logs.title}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
                {messages.logs.desc}
              </Typography.Paragraph>
            </div>
            <Button href="/admin/profile">{messages.users.backToHome}</Button>
          </Space>

          <Card>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              {logsUrl ? (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {messages.logs.urlLabel}
                  </Typography.Text>
                  <div style={{ wordBreak: "break-all" }}>{logsUrl}</div>
                </div>
              ) : (
                <div>
                  <Typography.Paragraph style={{ marginTop: 0, marginBottom: 8 }}>
                    {messages.logs.urlNotConfigured}
                  </Typography.Paragraph>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {messages.logs.configureHint}
                  </Typography.Paragraph>
                </div>
              )}

              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {messages.logs.issuesUrlLabel}
                </Typography.Text>
                <div style={{ wordBreak: "break-all" }}>{issuesUrl}</div>
              </div>

              <Space wrap>
                {logsUrl ? (
                  <Button type="primary" href={logsUrl} target="_blank" rel="noreferrer">
                    {messages.logs.openLogs}
                  </Button>
                ) : null}
                <Button href={issuesUrl} target="_blank" rel="noreferrer">
                  {messages.logs.openIssues}
                </Button>
              </Space>
            </Space>
          </Card>
        </Space>
      </div>
    </ConfigProvider>
  );
}


