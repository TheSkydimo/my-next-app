"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppLanguage, AppTheme } from "../../../client-prefs";
import { getInitialLanguage, getInitialTheme } from "../../../client-prefs";
import { getAdminMessages } from "../../../admin-i18n";
import { useAdmin } from "../../../contexts/AdminContext";
import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  Divider,
  Form,
  Input,
  notification,
  Row,
  Select,
  Space,
  Typography,
  theme as antdTheme,
  Result,
} from "antd";

const NOTIF_DRAFT_STORAGE_KEY = "admin_notifications_draft_v1";

type ScopeValue = "all_users" | "vip_users" | "non_vip_users" | "admins" | "email_list";

type LanguageMode = "both" | "zh" | "en";

export default function AdminNotificationSendForm() {
  const adminContext = useAdmin();
  const adminEmail = adminContext.profile?.email ?? null;

  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getInitialTheme());
  const messages = getAdminMessages(language);

  const [sending, setSending] = useState(false);
  const [form] = Form.useForm<{
    level: "info" | "warn" | "critical";
    type: string;
    scope: ScopeValue;
    targetEmails: string;
    languageMode: LanguageMode;
    titleZh: string;
    bodyZh: string;
    titleEn: string;
    bodyEn: string;
    linkUrl: string;
  }>();

  const [api, contextHolder] = notification.useNotification({
    placement: "topRight",
    showProgress: true,
    pauseOnHover: true,
    maxCount: 3,
  });

  const themeConfig = useMemo(() => {
    return {
      algorithm: appTheme === "dark" ? antdTheme.darkAlgorithm : undefined,
    };
  }, [appTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(NOTIF_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<{
        level: "info" | "warn" | "critical";
        type: string;
        scope: ScopeValue;
        targetEmails: string;
        languageMode: LanguageMode;
        titleZh: string;
        bodyZh: string;
        titleEn: string;
        bodyEn: string;
        linkUrl: string;
      }>;
      form.setFieldsValue({
        level: draft.level ?? undefined,
        type: draft.type ?? undefined,
        scope: draft.scope ?? undefined,
        targetEmails: draft.targetEmails ?? undefined,
        languageMode: draft.languageMode ?? undefined,
        titleZh: draft.titleZh ?? undefined,
        bodyZh: draft.bodyZh ?? undefined,
        titleEn: draft.titleEn ?? undefined,
        bodyEn: draft.bodyEn ?? undefined,
        linkUrl: draft.linkUrl ?? undefined,
      });
      window.sessionStorage.removeItem(NOTIF_DRAFT_STORAGE_KEY);
    } catch {
      // ignore draft errors
    }
  }, [form]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ language: AppLanguage }>;
      if (custom.detail?.language) setLanguage(custom.detail.language);
    };
    window.addEventListener("app-language-changed", handler as EventListener);
    return () => window.removeEventListener("app-language-changed", handler as EventListener);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ theme: AppTheme }>;
      if (custom.detail?.theme) setAppTheme(custom.detail.theme);
    };
    window.addEventListener("app-theme-changed", handler as EventListener);
    return () => window.removeEventListener("app-theme-changed", handler as EventListener);
  }, []);

  const send = async (values: {
    level: "info" | "warn" | "critical";
    type: string;
    scope: ScopeValue;
    targetEmails: string;
    languageMode: LanguageMode;
    titleZh: string;
    bodyZh: string;
    titleEn: string;
    bodyEn: string;
    linkUrl: string;
  }) => {
    if (!adminEmail) return;

    setSending(true);
    try {
      const targetEmails =
        values.scope === "email_list"
          ? values.targetEmails
              .split(/[\n,;]+/g)
              .map((x) => x.trim())
              .filter(Boolean)
              .slice(0, 200)
          : [];

      const titleZh = values.languageMode === "en" ? "" : values.titleZh.trim();
      const bodyZh = values.languageMode === "en" ? "" : values.bodyZh.trim();
      const titleEn = values.languageMode === "zh" ? "" : values.titleEn.trim();
      const bodyEn = values.languageMode === "zh" ? "" : values.bodyEn.trim();

      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: values.level,
          type: values.type.trim() || "admin_message",
          scope: values.scope,
          targetEmails,
          titleZh,
          bodyZh,
          titleEn,
          bodyEn,
          linkUrl: values.linkUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // Avoid leaking internal errors on 5xx. (4xx are safe & actionable for admin.)
        const safeMsg =
          res.status >= 500
            ? messages.common.unknownError
            : (text || messages.common.unknownError).slice(0, 300);
        throw new Error(safeMsg);
      }

      api.success({
        title: messages.notifications.successSent,
        description: messages.notifications.desc,
        duration: 3,
      });
      form.resetFields();
    } catch (e) {
      api.error({
        title: messages.common.unknownError,
        description: e instanceof Error ? e.message : messages.common.unknownError,
        duration: 4.5,
      });
    } finally {
      setSending(false);
    }
  };

  if (!adminEmail) {
    return (
      <ConfigProvider theme={themeConfig}>
        <div className="vben-page">
          <Card style={{ maxWidth: 820 }}>
            <Result status="403" title={messages.common.adminLoginRequired} />
          </Card>
        </div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={themeConfig}>
      {contextHolder}
      <div className="vben-page">
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {messages.notifications.title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              {messages.notifications.desc}
            </Typography.Paragraph>
          </div>

          <Row justify="center">
            <Col xs={24} lg={20} xl={16} xxl={14}>
              <Card style={{ width: "100%" }} bodyStyle={{ paddingTop: 16 }}>
                <Alert
                  type="info"
                  showIcon
                  message={messages.notifications.scopeLabel}
                  description={messages.notifications.scopeValueAll}
                  style={{ marginBottom: 16 }}
                />

                <Form
                  form={form}
                  layout="vertical"
                  requiredMark="optional"
                  initialValues={{
                    level: "info",
                    type: "admin_message",
                    scope: "all_users",
                    targetEmails: "",
                    languageMode: "both",
                    titleZh: "",
                    bodyZh: "",
                    titleEn: "",
                    bodyEn: "",
                    linkUrl: "",
                  }}
                  onFinish={(values) => void send(values)}
                >
                  <Row gutter={[16, 0]}>
                    <Col xs={24} md={10}>
                      <Form.Item
                        label={messages.notifications.scopeFieldLabel}
                        name="scope"
                        rules={[{ required: true }]}
                      >
                        <Select
                          options={[
                            { value: "all_users", label: messages.notifications.scopeAllUsers },
                            { value: "vip_users", label: messages.notifications.scopeVipUsers },
                            { value: "non_vip_users", label: messages.notifications.scopeNonVipUsers },
                            { value: "admins", label: messages.notifications.scopeAdmins },
                            { value: "email_list", label: messages.notifications.scopeEmailList },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={14}>
                      <Form.Item
                        label={messages.notifications.audienceFieldLabel}
                        name="languageMode"
                        rules={[{ required: true }]}
                        tooltip={messages.notifications.audienceTooltip}
                      >
                        <Select
                          options={[
                            { value: "both", label: messages.notifications.audienceBoth },
                            { value: "zh", label: messages.notifications.audienceZhOnly },
                            { value: "en", label: messages.notifications.audienceEnOnly },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, next) => prev.scope !== next.scope}
                  >
                    {({ getFieldValue }) => {
                      const scope = getFieldValue("scope") as ScopeValue;
                      if (scope !== "email_list") return null;
                      return (
                        <Form.Item
                          label={messages.notifications.targetEmailsLabel}
                          name="targetEmails"
                          rules={[{ required: true, message: messages.notifications.targetEmailsRequired }]}
                        >
                          <Input.TextArea
                            placeholder={messages.notifications.targetEmailsPlaceholder}
                            autoSize={{ minRows: 3, maxRows: 8 }}
                            maxLength={4000}
                            showCount
                          />
                        </Form.Item>
                      );
                    }}
                  </Form.Item>

                  <Row gutter={[16, 0]}>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        label={messages.notifications.levelLabel}
                        name="level"
                        rules={[{ required: true }]}
                      >
                        <Select
                          options={[
                            { value: "info", label: messages.notifications.levelInfo },
                            { value: "warn", label: messages.notifications.levelWarn },
                            { value: "critical", label: messages.notifications.levelCritical },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={16}>
                      <Form.Item
                        label={messages.notifications.typeLabel}
                        name="type"
                        tooltip={messages.notifications.typeTooltip}
                      >
                        <Input placeholder="admin_message" maxLength={50} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider style={{ margin: "8px 0 16px" }} />

                  <Row gutter={[16, 0]}>
                    <Col xs={24} md={12}>
                      <Form.Item noStyle shouldUpdate={(p, n) => p.languageMode !== n.languageMode}>
                        {({ getFieldValue }) => {
                          const mode = getFieldValue("languageMode") as LanguageMode;
                          return (
                            <Form.Item
                              label={messages.notifications.titleZhLabel}
                              name="titleZh"
                              rules={
                                mode === "en"
                                  ? []
                                  : [{ required: true, message: messages.notifications.errorTitleRequired }]
                              }
                            >
                              <Input
                                placeholder={messages.notifications.titleZhPlaceholder}
                                maxLength={80}
                                disabled={mode === "en"}
                              />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item noStyle shouldUpdate={(p, n) => p.languageMode !== n.languageMode}>
                        {({ getFieldValue }) => {
                          const mode = getFieldValue("languageMode") as LanguageMode;
                          return (
                            <Form.Item
                              label={messages.notifications.titleEnLabel}
                              name="titleEn"
                              rules={
                                mode === "zh"
                                  ? []
                                  : [{ required: true, message: messages.notifications.errorTitleRequired }]
                              }
                            >
                              <Input
                                placeholder={messages.notifications.titleEnPlaceholder}
                                maxLength={80}
                                disabled={mode === "zh"}
                              />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 0]}>
                    <Col xs={24} md={12}>
                      <Form.Item noStyle shouldUpdate={(p, n) => p.languageMode !== n.languageMode}>
                        {({ getFieldValue }) => {
                          const mode = getFieldValue("languageMode") as LanguageMode;
                          return (
                            <Form.Item
                              label={messages.notifications.bodyZhLabel}
                              name="bodyZh"
                              rules={
                                mode === "en"
                                  ? []
                                  : [{ required: true, message: messages.notifications.errorBodyRequired }]
                              }
                            >
                              <Input.TextArea
                                placeholder={messages.notifications.bodyZhPlaceholder}
                                autoSize={{ minRows: 6, maxRows: 14 }}
                                maxLength={1000}
                                showCount
                                disabled={mode === "en"}
                              />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item noStyle shouldUpdate={(p, n) => p.languageMode !== n.languageMode}>
                        {({ getFieldValue }) => {
                          const mode = getFieldValue("languageMode") as LanguageMode;
                          return (
                            <Form.Item
                              label={messages.notifications.bodyEnLabel}
                              name="bodyEn"
                              rules={
                                mode === "zh"
                                  ? []
                                  : [{ required: true, message: messages.notifications.errorBodyRequired }]
                              }
                            >
                              <Input.TextArea
                                placeholder={messages.notifications.bodyEnPlaceholder}
                                autoSize={{ minRows: 6, maxRows: 14 }}
                                maxLength={1000}
                                showCount
                                disabled={mode === "zh"}
                              />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item label={messages.notifications.linkUrlLabel} name="linkUrl">
                    <Input placeholder={messages.notifications.linkUrlPlaceholder} maxLength={300} />
                  </Form.Item>

                  <Space wrap>
                    <Button type="primary" htmlType="submit" loading={sending}>
                      {messages.notifications.sendButton}
                    </Button>
                    <Button
                      htmlType="button"
                      onClick={() => form.resetFields()}
                      disabled={sending}
                    >
                      {messages.notifications.resetButton}
                    </Button>
                  </Space>
                </Form>
              </Card>
            </Col>
          </Row>
        </Space>
      </div>
    </ConfigProvider>
  );
}


