"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AppLanguage, AppTheme } from "../../../client-prefs";
import { getInitialLanguage, getInitialTheme } from "../../../client-prefs";
import { getAdminMessages } from "../../../admin-i18n";
import { useAdmin } from "../../../contexts/AdminContext";
import { useApiCache } from "../../../contexts/ApiCacheContext";
import {
  Alert,
  Button,
  Card,
  ConfigProvider,
  Result,
  Space,
  Tabs,
  Typography,
  notification,
  theme as antdTheme,
  Popconfirm,
} from "antd";
import { UserOverviewCard, type UserDetail } from "./_components/UserOverviewCard";
import { UserOrdersTable, type AdminOrderItem } from "./_components/UserOrdersTable";

type SegmentParams = {
  [key: string]: string | string[] | undefined;
};

type AdminUserDetailPageProps = {
  params?: Promise<SegmentParams>;
};

function safeErrorFromResponse(
  res: Response,
  text: string,
  fallback: string
) {
  if (res.status >= 500) return fallback;
  const msg = (text || fallback).slice(0, 300);
  return msg || fallback;
}

export default function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  const adminContext = useAdmin();
  const adminEmail = adminContext.profile?.email ?? null;
  const isSuperAdmin = adminContext.profile?.isSuperAdmin ?? false;
  const cache = useApiCache();

  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getInitialTheme());
  const messages = getAdminMessages(language);

  const [userEmail, setUserEmail] = useState<string>("");
  const [user, setUser] = useState<UserDetail | null>(null);
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string>("");

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
    let cancelled = false;
    const resolveParams = async () => {
      if (!params) return;
      const raw = await params;
      const rawEmailValue = raw.email;
      const emailValue = Array.isArray(rawEmailValue)
        ? rawEmailValue[0] ?? ""
        : rawEmailValue ?? "";
      if (!emailValue || cancelled) return;
      const decoded = decodeURIComponent(emailValue);
      if (!cancelled) setUserEmail(decoded);
    };
    void resolveParams();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const load = async (opts?: { signal?: AbortSignal; bypassCache?: boolean }) => {
    if (!adminEmail || !userEmail) return;
    setLoading(true);
    setError("");
    try {
      const userUrl = `/api/admin/users/${encodeURIComponent(userEmail)}`;
      const ordersUrl = (() => {
        const orderParams = new URLSearchParams({ userEmail });
        return `/api/admin/orders?${orderParams.toString()}`;
      })();

      const bypassCache = !!opts?.bypassCache;
      const cachedUser = bypassCache ? undefined : cache.get<{ user?: UserDetail }>(userUrl);
      if (cachedUser && cachedUser.user) setUser(cachedUser.user);

      const cachedOrders = bypassCache ? undefined : cache.get<{ items?: AdminOrderItem[] }>(ordersUrl);
      if (cachedOrders && Array.isArray(cachedOrders.items)) setOrders(cachedOrders.items ?? []);

      // If both hit cache, no need to fetch.
      if (!bypassCache && cachedUser?.user && Array.isArray(cachedOrders?.items)) {
        setLoading(false);
        setError("");
        return;
      }

      if (!cachedUser?.user) {
        const userRes = await fetch(userUrl, {
          signal: opts?.signal,
          credentials: "include",
        });
        if (!userRes.ok) {
          const text = await userRes.text().catch(() => "");
          throw new Error(
            safeErrorFromResponse(userRes, text, messages.common.unknownError)
          );
        }
        const userData = (await userRes.json()) as { user: UserDetail };
        cache.set(userUrl, userData);
        setUser(userData.user);
      }

      if (!Array.isArray(cachedOrders?.items)) {
        const ordersRes = await fetch(ordersUrl, {
          signal: opts?.signal,
          credentials: "include",
        });
        if (!ordersRes.ok) {
          const text = await ordersRes.text().catch(() => "");
          throw new Error(
            safeErrorFromResponse(ordersRes, text, messages.common.unknownError)
          );
        }
        const ordersData = (await ordersRes.json()) as { items: AdminOrderItem[] };
        cache.set(ordersUrl, ordersData);
        setOrders(ordersData.items ?? []);
      }
    } catch (e) {
      if ((e as { name?: string } | null)?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : messages.common.unknownError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminEmail || !userEmail) return;
    const controller = new AbortController();
    void load({ signal: controller.signal });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminEmail, userEmail]);

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
        throw new Error(safeErrorFromResponse(res, text, messages.common.unknownError));
      }
      api.success({
        title: language === "zh-CN" ? "操作成功" : "Success",
        description: language === "zh-CN" ? "已完成管理操作" : "Admin action completed",
        duration: 3,
      });
      await load({ bypassCache: true });
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

  const canDelete =
    !!user &&
    user.email !== adminEmail &&
    !user.isVip;

  const canSetAdmin = !!user && !user.isAdmin && isSuperAdmin;
  const canUnsetAdmin =
    !!user && user.isAdmin && isSuperAdmin && user.email !== adminEmail;

  const copyEmail = async () => {
    if (!userEmail) return;
    try {
      await navigator.clipboard.writeText(userEmail);
      api.success({
        title: language === "zh-CN" ? "已复制" : "Copied",
        description: userEmail,
        duration: 2,
      });
    } catch {
      api.warning({
        title: language === "zh-CN" ? "复制失败" : "Copy failed",
        description: language === "zh-CN" ? "请手动复制邮箱" : "Please copy manually",
        duration: 3,
      });
    }
  };

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
                {language === "zh-CN" ? "用户详情" : "User Detail"}
              </Typography.Title>
              <Typography.Paragraph
                type="secondary"
                style={{ marginTop: 6, marginBottom: 0 }}
              >
                {user?.username || userEmail || "-"}
              </Typography.Paragraph>
            </div>
            <Space wrap>
              <Button onClick={() => void copyEmail()} disabled={!userEmail}>
                {language === "zh-CN" ? "复制邮箱" : "Copy email"}
              </Button>
              <Button href="/admin/users">
                {language === "zh-CN" ? "返回用户列表" : "Back to users"}
              </Button>
            </Space>
          </Space>

          {error ? (
            <Alert type="error" showIcon message={error} />
          ) : null}

          {user ? (
            <UserOverviewCard user={user} language={language} />
          ) : (
            <Card loading={loading} />
          )}

          <Card
            title={language === "zh-CN" ? "管理操作" : "Admin Actions"}
            style={{ width: "100%" }}
          >
            <Space wrap>
              <Button
                onClick={() =>
                  user ? void doAdminAction({ action: "set-admin", userEmail: user.email }) : undefined
                }
                loading={actionLoading}
                disabled={!canSetAdmin}
              >
                {language === "zh-CN" ? "设为管理员" : "Make admin"}
              </Button>

              <Button
                onClick={() =>
                  user ? void doAdminAction({ action: "unset-admin", userEmail: user.email }) : undefined
                }
                loading={actionLoading}
                disabled={!canUnsetAdmin}
              >
                {language === "zh-CN" ? "取消管理员" : "Revoke admin"}
              </Button>

              <Popconfirm
                title={language === "zh-CN" ? "确认删除该用户？" : "Delete this user?"}
                description={
                  language === "zh-CN"
                    ? "该操作不可撤销。会员未到期用户无法删除。"
                    : "This action cannot be undone. Active VIP users cannot be deleted."
                }
                onConfirm={() =>
                  user ? void doAdminAction({ action: "remove", userEmail: user.email }) : undefined
                }
                okText={language === "zh-CN" ? "删除" : "Delete"}
                cancelText={language === "zh-CN" ? "取消" : "Cancel"}
                okButtonProps={{ danger: true }}
                disabled={!canDelete}
              >
                <Button danger disabled={!canDelete} loading={actionLoading}>
                  {language === "zh-CN" ? "删除用户" : "Delete user"}
                </Button>
              </Popconfirm>
            </Space>

            {user && user.isVip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {language === "zh-CN"
                  ? "提示：会员未到期用户不能删除（后端会阻止删除）。"
                  : "Note: Active VIP users cannot be deleted (enforced by backend)."}
              </Typography.Paragraph>
            ) : null}
          </Card>

          <Card style={{ width: "100%" }} bodyStyle={{ paddingTop: 12 }}>
            <Tabs
              items={[
                {
                  key: "orders",
                  label:
                    language === "zh-CN"
                      ? `订单截图（${orders.length}）`
                      : `Order Screenshots (${orders.length})`,
                  children: (
                    <UserOrdersTable
                      items={orders}
                      language={language}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Space>
      </div>

    </ConfigProvider>
  );
}
