"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppLanguage, AppTheme } from "../../../client-prefs";
import { getInitialLanguage, getInitialTheme } from "../../../client-prefs";
import { getAdminMessages } from "../../../admin-i18n";
import { useAdmin } from "../../../contexts/AdminContext";
import type { TablePaginationConfig, TableProps } from "antd";
import {
  Button,
  Card,
  ConfigProvider,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  theme as antdTheme,
  Result,
  Popconfirm,
} from "antd";

type AdminEvent = {
  id: number;
  type: string;
  level: "info" | "warn" | "critical";
  audienceLang: "zh" | "en" | "both";
  titleZh: string;
  bodyZh: string;
  titleEn: string;
  bodyEn: string;
  linkUrl: string | null;
  scope: string;
  targetJson: string | null;
  createdByAdminId: number;
  createdByAdminRole: string;
  status: "sending" | "sent" | "failed";
  errorMessage: string | null;
  createdAt: string;
};

function safeDateTime(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

export default function AdminNotificationsHistoryPage() {
  const router = useRouter();
  const adminContext = useAdmin();
  const adminEmail = adminContext.profile?.email ?? null;

  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getInitialTheme());
  const messages = getAdminMessages(language);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AdminEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [filters, setFilters] = useState<{
    q: string;
    type: string;
    level: "" | "info" | "warn" | "critical";
    status: "" | "sending" | "sent" | "failed";
  }>({ q: "", type: "", level: "", status: "" });

  const [detail, setDetail] = useState<AdminEvent | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const levelTag = useCallback((level: AdminEvent["level"]) => {
    if (level === "critical") return <Tag color="error">{messages.notificationsHistory.tagLevelCritical}</Tag>;
    if (level === "warn") return <Tag color="warning">{messages.notificationsHistory.tagLevelWarn}</Tag>;
    return <Tag color="processing">{messages.notificationsHistory.tagLevelInfo}</Tag>;
  }, [messages.notificationsHistory.tagLevelCritical, messages.notificationsHistory.tagLevelInfo, messages.notificationsHistory.tagLevelWarn]);

  const statusTag = useCallback((status: AdminEvent["status"]) => {
    if (status === "sent") return <Tag color="success">{messages.notificationsHistory.tagStatusSent}</Tag>;
    if (status === "failed") return <Tag color="error">{messages.notificationsHistory.tagStatusFailed}</Tag>;
    return <Tag color="processing">{messages.notificationsHistory.tagStatusSending}</Tag>;
  }, [messages.notificationsHistory.tagStatusFailed, messages.notificationsHistory.tagStatusSending, messages.notificationsHistory.tagStatusSent]);

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

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.type.trim()) params.set("type", filters.type.trim());
      if (filters.level) params.set("level", filters.level);
      if (filters.status) params.set("status", filters.status);

      const res = await fetch(`/api/admin/notifications?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const safeMsg =
          res.status >= 500
            ? messages.common.unknownError
            : (text || messages.common.unknownError).slice(0, 300);
        throw new Error(safeMsg);
      }

      const data = (await res.json()) as {
        events?: AdminEvent[];
        pagination?: { total?: number; page?: number; pageSize?: number };
      };

      setItems(Array.isArray(data.events) ? data.events : []);
      setTotal(Number(data.pagination?.total ?? 0));
    } finally {
      setLoading(false);
    }
  }, [filters, messages.common.unknownError, page, pageSize]);

  const deleteEvent = useCallback(async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const safeMsg =
          res.status >= 500
            ? messages.common.unknownError
            : (text || messages.common.unknownError).slice(0, 300);
        throw new Error(safeMsg);
      }
      await fetchList();
    } finally {
      setDeletingId(null);
    }
  }, [fetchList, messages.common.unknownError]);

  const draftAndResend = useCallback((ev: AdminEvent) => {
    if (typeof window === "undefined") return;
    const languageMode: "both" | "zh" | "en" =
      ev.audienceLang === "both" ? "both" : ev.audienceLang === "zh" ? "zh" : "en";
    let targetEmails = "";
    if (ev.scope === "email_list" && ev.targetJson) {
      try {
        const parsed = JSON.parse(ev.targetJson) as { emails?: string[] };
        if (Array.isArray(parsed.emails)) targetEmails = parsed.emails.join("\n");
      } catch {
        // ignore
      }
    }

    window.sessionStorage.setItem(
      "admin_notifications_draft_v1",
      JSON.stringify({
        level: ev.level,
        type: ev.type,
        scope: ev.scope,
        targetEmails,
        languageMode,
        titleZh: ev.titleZh,
        bodyZh: ev.bodyZh,
        titleEn: ev.titleEn,
        bodyEn: ev.bodyEn,
        linkUrl: ev.linkUrl ?? "",
      })
    );
    router.push("/admin/notifications/send");
  }, [router]);

  useEffect(() => {
    if (!adminEmail) return;
    void fetchList();
  }, [adminEmail, fetchList]);

  const columns = useMemo<TableProps<AdminEvent>["columns"]>(() => {
    return [
      {
        title: messages.notificationsHistory.tableId,
        dataIndex: "id",
        key: "id",
        width: 90,
      },
      {
        title: messages.notificationsHistory.tableLevel,
        dataIndex: "level",
        key: "level",
        width: 110,
        render: (v: AdminEvent["level"]) => levelTag(v),
      },
      {
        title: messages.notificationsHistory.tableType,
        dataIndex: "type",
        key: "type",
        width: 160,
        ellipsis: true,
      },
      {
        title: messages.notificationsHistory.tableTitle,
        key: "title",
        render: (_: unknown, r: AdminEvent) => (
          <div style={{ minWidth: 260 }}>
            <Typography.Text strong ellipsis={{ tooltip: r.titleZh }}>
              {r.titleZh}
            </Typography.Text>
            <br />
            <Typography.Text type="secondary" ellipsis={{ tooltip: r.titleEn }}>
              {r.titleEn}
            </Typography.Text>
          </div>
        ),
      },
      {
        title: messages.notificationsHistory.tableStatus,
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (v: AdminEvent["status"]) => statusTag(v),
      },
      {
        title: messages.notificationsHistory.tableCreatedAt,
        dataIndex: "createdAt",
        key: "createdAt",
        width: 190,
        render: (v: string) => safeDateTime(v),
      },
      {
        title: messages.notificationsHistory.tableActions,
        key: "actions",
        width: 220,
        render: (_: unknown, r: AdminEvent) => (
          <Space>
            <Button size="small" onClick={() => setDetail(r)}>
              {messages.notificationsHistory.actionView}
            </Button>
            <Button size="small" onClick={() => draftAndResend(r)}>
              {messages.notificationsHistory.actionEditResend}
            </Button>
            <Popconfirm
              title={messages.notificationsHistory.deleteConfirmTitle}
              okText={messages.notificationsHistory.deleteOkText}
              okButtonProps={{ danger: true }}
              onConfirm={() => void deleteEvent(r.id)}
            >
              <Button size="small" danger loading={deletingId === r.id}>
                {messages.notificationsHistory.actionDelete}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];
  }, [
    deleteEvent,
    deletingId,
    draftAndResend,
    levelTag,
    messages.notificationsHistory.actionDelete,
    messages.notificationsHistory.actionEditResend,
    messages.notificationsHistory.actionView,
    messages.notificationsHistory.deleteConfirmTitle,
    messages.notificationsHistory.deleteOkText,
    messages.notificationsHistory.tableActions,
    messages.notificationsHistory.tableCreatedAt,
    messages.notificationsHistory.tableId,
    messages.notificationsHistory.tableLevel,
    messages.notificationsHistory.tableStatus,
    messages.notificationsHistory.tableTitle,
    messages.notificationsHistory.tableType,
    statusTag,
  ]);

  const pagination: TablePaginationConfig = useMemo(() => {
    return {
      current: page,
      pageSize,
      total,
      showSizeChanger: true,
      pageSizeOptions: [10, 20, 50],
      showTotal: (t) => messages.notificationsHistory.totalText(t),
    };
  }, [messages.notificationsHistory, page, pageSize, total]);

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
      <div className="vben-page">
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {messages.notificationsHistory.title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              {messages.notificationsHistory.desc}
            </Typography.Paragraph>
          </div>

          <Card>
            <Form
              layout="inline"
              onFinish={() => {
                setPage(1);
                void fetchList();
              }}
              initialValues={filters}
            >
              <Form.Item label={messages.notificationsHistory.filterSearchLabel} style={{ marginBottom: 12 }}>
                <Input
                  value={filters.q}
                  onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                  placeholder={messages.notificationsHistory.filterSearchPlaceholder}
                  allowClear
                  style={{ width: 220 }}
                />
              </Form.Item>

              <Form.Item label={messages.notificationsHistory.filterTypeLabel} style={{ marginBottom: 12 }}>
                <Input
                  value={filters.type}
                  onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}
                  placeholder={messages.notificationsHistory.filterTypePlaceholder}
                  allowClear
                  style={{ width: 160 }}
                />
              </Form.Item>

              <Form.Item label={messages.notificationsHistory.filterLevelLabel} style={{ marginBottom: 12 }}>
                <Select
                  value={filters.level}
                  onChange={(v) => setFilters((p) => ({ ...p, level: v }))}
                  style={{ width: 140 }}
                  options={[
                    { value: "", label: messages.notificationsHistory.filterLevelAll },
                    { value: "info", label: messages.notificationsHistory.filterLevelInfo },
                    { value: "warn", label: messages.notificationsHistory.filterLevelWarn },
                    { value: "critical", label: messages.notificationsHistory.filterLevelCritical },
                  ]}
                />
              </Form.Item>

              <Form.Item label={messages.notificationsHistory.filterStatusLabel} style={{ marginBottom: 12 }}>
                <Select
                  value={filters.status}
                  onChange={(v) => setFilters((p) => ({ ...p, status: v }))}
                  style={{ width: 140 }}
                  options={[
                    { value: "", label: messages.notificationsHistory.filterStatusAll },
                    { value: "sending", label: messages.notificationsHistory.filterStatusSending },
                    { value: "sent", label: messages.notificationsHistory.filterStatusSent },
                    { value: "failed", label: messages.notificationsHistory.filterStatusFailed },
                  ]}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 12 }}>
                <Space>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    {messages.notificationsHistory.applyButton}
                  </Button>
                  <Button
                    htmlType="button"
                    onClick={() => {
                      setFilters({ q: "", type: "", level: "", status: "" });
                      setPage(1);
                      setPageSize(20);
                      void fetchList();
                    }}
                    disabled={loading}
                  >
                    {messages.notificationsHistory.resetButton}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>

          <Card bodyStyle={{ padding: 0 }}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={items}
              loading={loading}
              pagination={pagination}
              onChange={(p) => {
                const nextPage = Number(p.current ?? 1);
                const nextSize = Number(p.pageSize ?? 20);
                setPage(nextPage);
                setPageSize(nextSize);
              }}
              scroll={{ x: 980 }}
            />
          </Card>
        </Space>
      </div>

      <Modal
        title={detail ? messages.notificationsHistory.modalTitle(detail.id) : messages.notificationsHistory.title}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={[
          <Button key="close" onClick={() => setDetail(null)}>
            {messages.notificationsHistory.modalClose}
          </Button>,
        ]}
        width={860}
      >
        {detail && (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Space wrap>
              {levelTag(detail.level)}
              {statusTag(detail.status)}
              <Tag>{detail.type}</Tag>
              {detail.linkUrl ? (
                <Tag color="blue">{detail.linkUrl}</Tag>
              ) : (
                <Tag>{messages.notificationsHistory.modalNoLink}</Tag>
              )}
            </Space>

            <div>
              <Typography.Text type="secondary">{messages.notificationsHistory.modalCreated}</Typography.Text>
              <div>{safeDateTime(detail.createdAt)}</div>
            </div>

            {detail.errorMessage ? (
              <div>
                <Typography.Text type="secondary">{messages.notificationsHistory.modalError}</Typography.Text>
                <div style={{ color: "#cf1322" }}>{detail.errorMessage}</div>
              </div>
            ) : null}

            <div>
              <Typography.Text type="secondary">ZH</Typography.Text>
              <Typography.Title level={5} style={{ margin: "4px 0" }}>
                {detail.titleZh}
              </Typography.Title>
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                {detail.bodyZh}
              </Typography.Paragraph>
            </div>

            <div>
              <Typography.Text type="secondary">EN</Typography.Text>
              <Typography.Title level={5} style={{ margin: "4px 0" }}>
                {detail.titleEn}
              </Typography.Title>
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                {detail.bodyEn}
              </Typography.Paragraph>
            </div>
          </Space>
        )}
      </Modal>
    </ConfigProvider>
  );
}


