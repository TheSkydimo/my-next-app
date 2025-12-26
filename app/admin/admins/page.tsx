"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ColumnsType } from "antd/es/table";
import type { AppLanguage, AppTheme } from "../../client-prefs";
import { getInitialLanguage, getInitialTheme } from "../../client-prefs";
import { getAdminMessages } from "../../admin-i18n";
import { useAdmin } from "../../contexts/AdminContext";
import { useApiCache } from "../../contexts/ApiCacheContext";
import {
  Alert,
  Button,
  Card,
  ConfigProvider,
  Grid,
  Input,
  Popconfirm,
  Result,
  Space,
  Table,
  Typography,
  notification,
  theme as antdTheme,
} from "antd";

type AdminItem = {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
};

export default function AdminAdminsPage() {
  // 使用 AdminContext 获取预加载的管理员信息
  const adminContext = useAdmin();
  const isSuperAdmin = adminContext.profile?.isSuperAdmin ?? false;
  const adminEmail = isSuperAdmin ? (adminContext.profile?.email ?? null) : null;
  const unauthorized = adminContext.initialized && !isSuperAdmin;
  const cache = useApiCache();

  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getInitialTheme());
  const messages = getAdminMessages(language);

  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [pagination, setPagination] = useState<{
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null>(null);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [api, contextHolder] = notification.useNotification({
    placement: "topRight",
    showProgress: true,
    pauseOnHover: true,
    maxCount: 3,
  });

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
      if (custom.detail?.theme) setAppTheme(custom.detail.theme);
    };
    window.addEventListener("app-theme-changed", handler as EventListener);
    return () =>
      window.removeEventListener("app-theme-changed", handler as EventListener);
  }, []);

  const themeConfig = useMemo(() => {
    return {
      algorithm: appTheme === "dark" ? antdTheme.darkAlgorithm : undefined,
    };
  }, [appTheme]);

  function safeErrorFromResponse(res: Response, text: string, fallback: string) {
    if (res.status >= 500) return fallback;
    const msg = (text || fallback).slice(0, 300);
    return msg || fallback;
  }

  const fetchAdmins = async (opts?: {
    q?: string;
    page?: number;
    pageSize?: number;
    /** 写操作成功后：绕过 cache-first，强制拉取最新数据并覆盖缓存 */
    bypassCache?: boolean;
  }) => {
    if (!adminEmail) return;
    const bypassCache = !!opts?.bypassCache;
    const q = (opts?.q ?? keyword).trim();
    const page = opts?.page ?? pagination?.page ?? 1;
    const pageSize = opts?.pageSize ?? pagination?.pageSize ?? 15;
    try {
      const params = new URLSearchParams({
        role: "admin",
        page: String(page),
        pageSize: String(pageSize),
      });
      if (q) params.set("q", q);
      const url = `/api/admin/users?${params.toString()}`;

      if (!bypassCache) {
        const cached = cache.get<{ users: AdminItem[]; pagination?: typeof pagination }>(url);
        if (cached && Array.isArray((cached as { users?: unknown }).users)) {
          const c = cached as { users: AdminItem[]; pagination?: typeof pagination };
          setAdmins(c.users ?? []);
          setPagination((c.pagination as typeof pagination) ?? null);
          setLoading(false);
          setError("");
          return;
        }
      }

      setLoading(true);
      setError("");

      const res = await fetch(url, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          safeErrorFromResponse(res, text, messages.common.unknownError)
        );
      }
      const data = (await res.json()) as {
        users: AdminItem[];
        pagination?: {
          total: number;
          page: number;
          pageSize: number;
          totalPages: number;
        };
      };
      cache.set(url, data);
      setAdmins(data.users ?? []);
      setPagination(data.pagination ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.common.unknownError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminEmail) void fetchAdmins({ q: "", page: 1, pageSize: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminEmail]);

  const doAction = async (action: "remove" | "unset-admin", item: AdminItem) => {
    if (!adminEmail) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          userEmail: item.email,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          safeErrorFromResponse(res, text, messages.common.unknownError)
        );
      }

      api.success({
        title: language === "zh-CN" ? "操作成功" : "Success",
        description: language === "zh-CN" ? "已完成管理操作" : "Admin action completed",
        duration: 3,
      });

      await fetchAdmins({ bypassCache: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : messages.common.unknownError;
      api.error({
        title: messages.common.unknownError,
        description: msg,
        duration: 4.5,
      });
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const columns: ColumnsType<AdminItem> = useMemo(() => {
    return [
      {
        title: messages.admins.tableIndex,
        key: "index",
        width: 72,
        align: "center",
        render: (_: unknown, __: AdminItem, index: number) => {
          const base = pagination ? (pagination.page - 1) * pagination.pageSize : 0;
          return base + index + 1;
        },
      },
      {
        title: messages.admins.tableUsername,
        dataIndex: "username",
        key: "username",
        width: 180,
        render: (v: string) => v || "-",
      },
      {
        title: messages.admins.tableEmail,
        dataIndex: "email",
        key: "email",
        render: (email: string) => (
          <Link href={`/admin/users/${encodeURIComponent(email)}`}>
            <Typography.Link>{email}</Typography.Link>
          </Link>
        ),
      },
      {
        title: messages.admins.tableCreatedAt,
        dataIndex: "createdAt",
        key: "createdAt",
        width: 200,
        responsive: ["md"],
        render: (v: string) => <Typography.Text type="secondary">{v}</Typography.Text>,
      },
      {
        title: messages.admins.tableActions,
        key: "actions",
        width: isMobile ? 260 : 320,
        fixed: screens.md ? "right" : undefined,
        render: (_: unknown, row: AdminItem) => {
          const isSelf = row.email === adminEmail;
          return (
            <Space wrap size={8}>
              <Popconfirm
                title={language === "zh-CN" ? "确认取消管理员？" : "Revoke admin role?"}
                onConfirm={() => void doAction("unset-admin", row)}
                okText={language === "zh-CN" ? "确认" : "OK"}
                cancelText={language === "zh-CN" ? "取消" : "Cancel"}
                disabled={isSelf}
              >
                <Button size="small" disabled={isSelf} loading={actionLoading}>
                  {messages.admins.btnUnsetAdmin}
                </Button>
              </Popconfirm>

              <Popconfirm
                title={language === "zh-CN" ? "确认删除该管理员？" : "Delete this admin?"}
                description={
                  language === "zh-CN"
                    ? "该操作不可撤销。超级管理员账号无法删除。"
                    : "This action cannot be undone. Super admin cannot be deleted."
                }
                onConfirm={() => void doAction("remove", row)}
                okText={language === "zh-CN" ? "删除" : "Delete"}
                cancelText={language === "zh-CN" ? "取消" : "Cancel"}
                okButtonProps={{ danger: true }}
                disabled={isSelf}
              >
                <Button danger size="small" disabled={isSelf} loading={actionLoading}>
                  {messages.admins.btnDelete}
                </Button>
              </Popconfirm>
            </Space>
          );
        },
      },
    ];
  }, [actionLoading, adminEmail, doAction, isMobile, language, messages.admins, pagination, screens.md]);

  if (unauthorized) {
    return (
      <ConfigProvider theme={themeConfig}>
        <div className="vben-page">
          <Card style={{ maxWidth: 820 }}>
            <Result
              status="403"
              title={messages.admins.title}
              subTitle={messages.admins.unauthorizedDesc}
            />
          </Card>
        </div>
      </ConfigProvider>
    );
  }

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
      {contextHolder}
      <div className="vben-page">
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Space align="start" style={{ width: "100%", justifyContent: "space-between" }} wrap>
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {messages.admins.title}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
                {messages.admins.limitTip}
              </Typography.Paragraph>
            </div>
            <Button href="/admin">{language === "zh-CN" ? "返回" : "Back"}</Button>
          </Space>

          <Card>
            <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
              <Input.Search
                style={{ maxWidth: 520 }}
                placeholder={language === "zh-CN" ? "按用户名/邮箱搜索" : "Search by username/email"}
                allowClear
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onSearch={(v) => void fetchAdmins({ q: v, page: 1 })}
                enterButton={language === "zh-CN" ? "搜索" : "Search"}
                disabled={loading}
              />
              <Button onClick={() => void fetchAdmins()} loading={loading}>
                {language === "zh-CN" ? "刷新" : "Refresh"}
              </Button>
            </Space>
          </Card>

          {error ? <Alert type="error" showIcon message={error} /> : null}

          <Card style={{ width: "100%" }} bodyStyle={{ paddingTop: 12 }}>
            <Table<AdminItem>
              rowKey="id"
              dataSource={admins}
              columns={columns}
              loading={loading}
              size={isMobile ? "small" : "middle"}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: messages.admins.emptyText }}
              pagination={
                pagination
                  ? {
                      current: pagination.page,
                      pageSize: pagination.pageSize,
                      total: pagination.total,
                      showSizeChanger: true,
                      responsive: true,
                      onChange: (p, ps) => void fetchAdmins({ page: p, pageSize: ps }),
                    }
                  : false
              }
            />
          </Card>
        </Space>
      </div>
    </ConfigProvider>
  );
}


