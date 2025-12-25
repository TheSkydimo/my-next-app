"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppLanguage, AppTheme } from "../../client-prefs";
import { getInitialLanguage, getInitialTheme } from "../../client-prefs";
import { getAdminMessages } from "../../admin-i18n";
import { useAdmin } from "../../contexts/AdminContext";
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

export default function AdminNotificationsPage() {
  const adminContext = useAdmin();
  const adminEmail = adminContext.profile?.email ?? null;

  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getInitialTheme());
  const messages = getAdminMessages(language);

  const [sending, setSending] = useState(false);
  const [form] = Form.useForm<{
    level: "info" | "warn" | "critical";
    type: string;
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
    titleZh: string;
    bodyZh: string;
    titleEn: string;
    bodyEn: string;
    linkUrl: string;
  }) => {
    if (!adminEmail) return;

    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: values.level,
          type: values.type.trim() || "admin_message",
          titleZh: values.titleZh.trim(),
          bodyZh: values.bodyZh.trim(),
          titleEn: values.titleEn.trim(),
          bodyEn: values.bodyEn.trim(),
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

          <Card style={{ maxWidth: 920 }} bodyStyle={{ paddingTop: 16 }}>
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
                titleZh: "",
                bodyZh: "",
                titleEn: "",
                bodyEn: "",
                linkUrl: "",
              }}
              onFinish={(values) => void send(values)}
            >
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
                    tooltip="Defaults to admin_message"
                  >
                    <Input placeholder="admin_message" maxLength={50} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: "8px 0 16px" }} />

              <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={messages.notifications.titleZhLabel}
                    name="titleZh"
                    rules={[{ required: true, message: messages.notifications.errorTitleRequired }]}
                  >
                    <Input placeholder={messages.notifications.titleZhPlaceholder} maxLength={80} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={messages.notifications.titleEnLabel}
                    name="titleEn"
                    rules={[{ required: true, message: messages.notifications.errorTitleRequired }]}
                  >
                    <Input placeholder={messages.notifications.titleEnPlaceholder} maxLength={80} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={messages.notifications.bodyZhLabel}
                    name="bodyZh"
                    rules={[{ required: true, message: messages.notifications.errorBodyRequired }]}
                  >
                    <Input.TextArea
                      placeholder={messages.notifications.bodyZhPlaceholder}
                      autoSize={{ minRows: 6, maxRows: 14 }}
                      maxLength={1000}
                      showCount
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={messages.notifications.bodyEnLabel}
                    name="bodyEn"
                    rules={[{ required: true, message: messages.notifications.errorBodyRequired }]}
                  >
                    <Input.TextArea
                      placeholder={messages.notifications.bodyEnPlaceholder}
                      autoSize={{ minRows: 6, maxRows: 14 }}
                      maxLength={1000}
                      showCount
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label={messages.notifications.linkUrlLabel} name="linkUrl">
                <Input placeholder={messages.notifications.linkUrlPlaceholder} maxLength={300} />
              </Form.Item>

              <Space>
                <Button type="primary" htmlType="submit" loading={sending}>
                  {messages.notifications.sendButton}
                </Button>
                <Button
                  htmlType="button"
                  onClick={() => form.resetFields()}
                  disabled={sending}
                >
                  Reset
                </Button>
              </Space>
            </Form>
          </Card>
        </Space>
      </div>
    </ConfigProvider>
  );
}


