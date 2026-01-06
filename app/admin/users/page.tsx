"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Tag,
  Typography,
  notification,
  theme as antdTheme,
} from "antd";
import { formatDateTime, getClientTimeZone } from "../../_utils/dateTime";

type UserItem = {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  isVip: boolean;
  vipExpiresAt: string | null;
  createdAt: string;
};

type Pagination = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const ADMIN_USERS_PAGE_SIZE_STORAGE_KEY = "admin_users_page_size";

function readStoredAdminUsersPageSize(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ADMIN_USERS_PAGE_SIZE_STORAGE_KEY);
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    // Keep in sync with API clamp (max 100).
    if (n < 1 || n > 100) return null;
    return Math.floor(n);
  } catch {
    return null;
  }
}

function safeErrorFromResponse(res: Response, text: string, fallback: string) {
  if (res.status >= 500) return fallback;
  const msg = (text || fallback).slice(0, 300);
  return msg || fallback;
}

export default function AdminUsersPage() {
  const adminContext = useAdmin();
  const adminEmail = adminContext.profile?.email ?? null;
  const isSuperAdmin = adminContext.profile?.isSuperAdmin ?? false;
  const cache = useApiCache();

  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getInitialTheme());
  const messages = getAdminMessages(language);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [keyword, setKeyword] = useState("");
  // Use refs to avoid re-creating fetchUsers on every paging/typing and accidentally re-triggering init effect.
  const paginationRef = useRef<Pagination | null>(null);
  const keywordRef = useRef<string>("");
  // Prevent stale requests (e.g. Pagination fires multiple callbacks) from overwriting latest state.
  const fetchSeqRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const viewerTz = useMemo(() => getClientTimeZone(), []);

  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

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
    return () =>
      window.removeEventListener("app-language-changed", handler as EventListener);
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

  useEffect(() => {
    paginationRef.current = pagination;
    // Persist selected page size for this page in sessionStorage to avoid occasional resets on remount.
    if (typeof window !== "undefined" && pagination?.pageSize) {
      try {
        window.sessionStorage.setItem(
          ADMIN_USERS_PAGE_SIZE_STORAGE_KEY,
          String(pagination.pageSize)
        );
      } catch {
        // ignore
      }
    }
  }, [pagination]);

  const setPaginationOptimistic = useCallback((next: { page?: number; pageSize?: number }) => {
    if (!next.page && !next.pageSize) return;
    setPagination((prev) => {
      if (!prev) return prev;
      const pageSize = next.pageSize ?? prev.pageSize;
      const page = next.page ?? prev.page;
      const updated: Pagination = { ...prev, page, pageSize };
      // Keep ref in sync immediately (before async fetch resolves).
      paginationRef.current = updated;
      return updated;
    });
  }, []);

  useEffect(() => {
    keywordRef.current = keyword;
  }, [keyword]);

  const fetchUsers = useCallback(async (opts?: {
    q?: string;
    page?: number;
    pageSize?: number;
    /** 写操作成功后：绕过 cache-first，强制拉取最新数据并覆盖缓存 */
    bypassCache?: boolean;
  }) => {
    if (!adminEmail) return;
    const seq = ++fetchSeqRef.current;
    const bypassCache = !!opts?.bypassCache;
    const q = (opts?.q ?? keywordRef.current).trim();
    const page = opts?.page ?? paginationRef.current?.page ?? 1;
    const pageSize = opts?.pageSize ?? paginationRef.current?.pageSize ?? 15;
    try {
      const params = new URLSearchParams({
        role: "user",
        page: String(page),
        pageSize: String(pageSize),
      });
      if (q) params.set("q", q);
      const url = `/api/admin/users?${params.toString()}`;

      // Cache-first: if present, use it and skip loading/request.
      if (!bypassCache) {
        const cached = cache.get<{ users: UserItem[]; pagination: Pagination }>(url);
        if (cached && Array.isArray(cached.users) && cached.pagination) {
          if (seq !== fetchSeqRef.current) return;
          setUsers(cached.users ?? []);
          setPagination(cached.pagination);
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
        throw new Error(safeErrorFromResponse(res, text, messages.common.unknownError));
      }
      const data = (await res.json()) as { users: UserItem[]; pagination: Pagination };
      if (seq !== fetchSeqRef.current) return;
      cache.set(url, data);
      setUsers(data.users ?? []);
      setPagination(data.pagination);
    } catch (e) {
      if (seq !== fetchSeqRef.current) return;
      setError(e instanceof Error ? e.message : messages.common.unknownError);
    } finally {
      if (seq !== fetchSeqRef.current) return;
      setLoading(false);
    }
  }, [adminEmail, cache, messages.common.unknownError]);

  useEffect(() => {
    if (!adminEmail) return;
    const stored = readStoredAdminUsersPageSize();
    void fetchUsers({ q: "", page: 1, pageSize: stored ?? 15 });
  }, [adminEmail, fetchUsers]);

  const columns: ColumnsType<UserItem> = useMemo(() => {
    const doAdminAction = async (body: {
      action: "remove" | "set-admin" | "unset-admin";
      userEmail: string;
    }) => {
      if (!adminEmail) return;
      setActionLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
        await fetchUsers({ bypassCache: true });
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

    return [
      {
        title: language === "zh-CN" ? "序号" : "#",
        dataIndex: "id",
        key: "index",
        width: 72,
        align: "center",
        render: (_: unknown, __: UserItem, index: number) => {
          const base = pagination ? (pagination.page - 1) * pagination.pageSize : 0;
          return base + index + 1;
        },
      },
      {
        title: language === "zh-CN" ? "用户名" : "Username",
        dataIndex: "username",
        key: "username",
        width: 160,
        render: (v: string) => v || "-",
      },
      {
        title: language === "zh-CN" ? "邮箱" : "Email",
        dataIndex: "email",
        key: "email",
        render: (email: string) => (
          <Link href={`/admin/users/${encodeURIComponent(email)}`}>
            <Typography.Link>{email}</Typography.Link>
          </Link>
        ),
      },
      {
        title: language === "zh-CN" ? "角色" : "Role",
        dataIndex: "isAdmin",
        key: "role",
        width: 120,
        align: "center",
        render: (isAdmin: boolean) =>
          isAdmin ? (
            <Tag color="blue">{language === "zh-CN" ? "管理员" : "Admin"}</Tag>
          ) : (
            <Tag>{language === "zh-CN" ? "用户" : "User"}</Tag>
          ),
      },
      {
        title: language === "zh-CN" ? "会员" : "VIP",
        dataIndex: "isVip",
        key: "vip",
        width: 120,
        align: "center",
        render: (isVip: boolean) =>
          isVip ? (
            <Tag color="green">{language === "zh-CN" ? "会员" : "VIP"}</Tag>
          ) : (
            <Tag>{language === "zh-CN" ? "非会员" : "Non‑VIP"}</Tag>
          ),
      },
      {
        title: language === "zh-CN" ? "到期时间" : "Expires",
        dataIndex: "vipExpiresAt",
        key: "vipExpiresAt",
        width: 180,
        responsive: ["md"],
        render: (v: string | null) => (
          <Typography.Text type="secondary">
            {v ? formatDateTime(v, { locale: language, timeZone: viewerTz ?? undefined }) : "-"}
          </Typography.Text>
        ),
      },
      {
        title: language === "zh-CN" ? "注册时间" : "Created",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 180,
        responsive: ["md"],
        render: (v: string) => (
          <Typography.Text type="secondary">
            {formatDateTime(v, { locale: language, timeZone: viewerTz ?? undefined })}
          </Typography.Text>
        ),
      },
      {
        title: language === "zh-CN" ? "操作" : "Actions",
        key: "actions",
        width: isMobile ? 280 : 360,
        fixed: screens.md ? "right" : undefined,
        render: (_: unknown, row: UserItem) => {
          const canSetAdmin = isSuperAdmin && !row.isAdmin;
          const canDelete = row.email !== adminEmail && !row.isVip;
          return (
            <Space wrap size={8}>
              {canSetAdmin ? (
                <Popconfirm
                  title={language === "zh-CN" ? "确认设为管理员？" : "Make this user admin?"}
                  onConfirm={() =>
                    void doAdminAction({ action: "set-admin", userEmail: row.email })
                  }
                  okText={language === "zh-CN" ? "确认" : "OK"}
                  cancelText={language === "zh-CN" ? "取消" : "Cancel"}
                >
                  <Button size="small" disabled={actionLoading}>
                    {language === "zh-CN" ? "设为管理员" : "Make admin"}
                  </Button>
                </Popconfirm>
              ) : null}
              <Popconfirm
                title={language === "zh-CN" ? "确认删除该用户？" : "Delete this user?"}
                description={
                  language === "zh-CN"
                    ? "该操作不可撤销。会员未到期用户无法删除。"
                    : "This action cannot be undone. Active VIP users cannot be deleted."
                }
                onConfirm={() => void doAdminAction({ action: "remove", userEmail: row.email })}
                okText={language === "zh-CN" ? "删除" : "Delete"}
                cancelText={language === "zh-CN" ? "取消" : "Cancel"}
                okButtonProps={{ danger: true }}
                disabled={!canDelete}
              >
                <Button danger size="small" disabled={!canDelete} loading={actionLoading}>
                  {language === "zh-CN" ? "删除" : "Delete"}
                </Button>
              </Popconfirm>
            </Space>
          );
        },
      },
    ];
  }, [
    actionLoading,
    adminEmail,
    api,
    fetchUsers,
    isMobile,
    isSuperAdmin,
    language,
    messages.common.unknownError,
    pagination,
    screens.md,
    viewerTz,
  ]);

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
          <Space
            align="start"
            style={{ width: "100%", justifyContent: "space-between" }}
            wrap
          >
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {messages.users.title}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
                {messages.users.adminLabelPrefix}
                {adminEmail}
              </Typography.Paragraph>
            </div>
            <Button href="/admin/profile">{messages.users.backToHome}</Button>
          </Space>

          <Card>
            <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
              <Input.Search
                style={{ maxWidth: 520 }}
                placeholder={messages.users.searchPlaceholder}
                allowClear
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onSearch={(v) => void fetchUsers({ q: v, page: 1 })}
                enterButton={messages.users.searchButton}
                disabled={loading}
              />
              <Space wrap>
                <Button
                  onClick={() => {
                    setKeyword("");
                    void fetchUsers({ q: "", page: 1 });
                  }}
                  disabled={loading}
                >
                  {messages.users.resetButton}
                </Button>
                <Button onClick={() => void fetchUsers()} loading={loading}>
                  {language === "zh-CN" ? "刷新" : "Refresh"}
                </Button>
              </Space>
            </Space>
          </Card>

          {error ? <Alert type="error" showIcon message={error} /> : null}

          <Card style={{ width: "100%" }} bodyStyle={{ paddingTop: 12 }}>
            <Table<UserItem>
              rowKey="id"
              dataSource={users}
              columns={columns}
              loading={loading}
              size={isMobile ? "small" : "middle"}
              scroll={{ x: "max-content" }}
              pagination={
                pagination
                  ? {
                      current: pagination.page,
                      pageSize: pagination.pageSize,
                      total: pagination.total,
                      showSizeChanger: true,
                      // Ensure current default (15) remains selectable and options are consistent.
                      pageSizeOptions: [10, 15, 20, 50, 100],
                      // Optional: allow quickly jumping to a page when pages are large.
                      showQuickJumper: true,
                      responsive: true,
                      onChange: (p, ps) => {
                        const pageSize =
                          typeof ps === "number" && Number.isFinite(ps)
                            ? ps
                            : paginationRef.current?.pageSize ?? pagination.pageSize;
                        setPaginationOptimistic({ page: p, pageSize });
                        void fetchUsers({ page: p, pageSize });
                      },
                      // Some antd versions fire pageSize changes via onShowSizeChange more reliably than onChange.
                      onShowSizeChange: (_current, size) => {
                        // Reset to first page when pageSize changes to avoid out-of-range pages.
                        setPaginationOptimistic({ page: 1, pageSize: size });
                        void fetchUsers({ page: 1, pageSize: size });
                      },
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


