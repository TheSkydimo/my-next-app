"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { UploadFile } from "antd";
import type { AppLanguage, AppTheme } from "../../client-prefs";
import { getInitialLanguage, getInitialTheme } from "../../client-prefs";
import { getAdminMessages } from "../../admin-i18n";
import { useAdmin } from "../../contexts/AdminContext";
import { useApiCache } from "../../contexts/ApiCacheContext";
import {
  Alert,
  Avatar,
  Button,
  Card,
  ConfigProvider,
  Descriptions,
  Divider,
  Form,
  Grid,
  Image,
  Input,
  Modal,
  Result,
  Space,
  Tabs,
  Tag,
  Typography,
  Upload,
  notification,
  theme as antdTheme,
} from "antd";

type OrderThumb = {
  id: number;
  deviceId: string;
  imageUrl: string;
  note: string | null;
  createdAt: string;
};

function safeErrorFromResponse(res: Response, text: string, fallback: string) {
  if (res.status >= 500) return fallback;
  const msg = (text || fallback).slice(0, 300);
  return msg || fallback;
}

export default function AdminProfilePage() {
  const adminContext = useAdmin();
  const adminProfile = adminContext.profile;
  const adminEmail = adminProfile?.email ?? null;
  const cache = useApiCache();
  const adminRole = adminProfile?.role ?? null;

  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getInitialTheme());
  const messages = getAdminMessages(language);

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

  const [orders, setOrders] = useState<OrderThumb[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [usernameModalOpen, setUsernameModalOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const [sendingCode, setSendingCode] = useState(false);
  const [emailCodeChallengeId, setEmailCodeChallengeId] = useState("");

  const [avatarFileList, setAvatarFileList] = useState<UploadFile[]>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const [usernameForm] = Form.useForm<{ username: string }>();
  const [avatarForm] = Form.useForm<{ avatarUrl: string }>();
  const [emailForm] = Form.useForm<{ newEmail: string; emailCode: string }>();

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

  useEffect(() => {
    if (!adminEmail) return;
    usernameForm.setFieldsValue({ username: adminProfile?.username ?? "" });
    avatarForm.setFieldsValue({ avatarUrl: adminProfile?.avatarUrl ?? "" });
    setAvatarPreviewUrl(adminProfile?.avatarUrl ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminEmail]);

  useEffect(() => {
    if (!adminEmail) return;

    const loadOrders = async (email: string) => {
      setOrdersLoading(true);
      try {
        const params = new URLSearchParams({ userEmail: email });
        const url = `/api/admin/orders?${params.toString()}`;

        const cached = cache.get<{ items?: { id: number; deviceId: string; imageUrl: string; note: string | null; createdAt: string }[] }>(url);
        if (cached && Array.isArray(cached.items)) {
          setOrders(
            (cached.items ?? []).map((o) => ({
              id: o.id,
              deviceId: o.deviceId,
              imageUrl: o.imageUrl,
              note: o.note,
              createdAt: o.createdAt,
            }))
          );
          setOrdersLoading(false);
          return;
        }

        const res = await fetch(url, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          items: {
            id: number;
            deviceId: string;
            imageUrl: string;
            note: string | null;
            createdAt: string;
          }[];
        };
        cache.set(url, data);
        setOrders(
          (data.items ?? []).map((o) => ({
            id: o.id,
            deviceId: o.deviceId,
            imageUrl: o.imageUrl,
            note: o.note,
            createdAt: o.createdAt,
          }))
        );
      } catch {
        // ignore
      } finally {
        setOrdersLoading(false);
      }
    };

    void loadOrders(adminEmail);
  }, [adminEmail, cache]);

  const openUsernameModal = () => {
    usernameForm.setFieldsValue({ username: adminProfile?.username ?? "" });
    setUsernameModalOpen(true);
  };

  const openAvatarModal = () => {
    setAvatarFileList([]);
    setAvatarPreviewUrl(adminProfile?.avatarUrl ?? null);
    avatarForm.setFieldsValue({ avatarUrl: adminProfile?.avatarUrl ?? "" });
    setAvatarModalOpen(true);
  };

  const openEmailModal = () => {
    emailForm.resetFields();
    setEmailCodeChallengeId("");
    setEmailModalOpen(true);
  };

  const doUpdateUsername = async (username: string) => {
    if (!adminEmail) return;
    const key = "admin-profile-username";
    api.open({
      key,
      message: language === "zh-CN" ? "正在保存…" : "Saving…",
      description: language === "zh-CN" ? "正在更新用户名" : "Updating username",
      duration: 0,
    });
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(safeErrorFromResponse(res, text, messages.common.unknownError));
      }
      adminContext.updateProfile({ username: username.trim() });
      api.success({
        key,
        message: language === "zh-CN" ? "已保存" : "Saved",
        description: messages.profile.successUsernameUpdated,
        duration: 2.6,
      });
      setUsernameModalOpen(false);
    } catch (e) {
      api.error({
        key,
        message: messages.common.unknownError,
        description: e instanceof Error ? e.message : messages.common.unknownError,
        duration: 4,
      });
    }
  };

  const doUpdateAvatar = async (avatarUrl: string | null) => {
    if (!adminEmail) return;
    const key = "admin-profile-avatar";
    api.open({
      key,
      message: language === "zh-CN" ? "正在保存…" : "Saving…",
      description: language === "zh-CN" ? "正在更新头像" : "Updating avatar",
      duration: 0,
    });
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(safeErrorFromResponse(res, text, messages.common.unknownError));
      }
      const data = (await res.json().catch(() => null)) as { avatarUrl?: string | null } | null;
      const newAvatarUrl = typeof data?.avatarUrl === "string" ? data.avatarUrl : null;
      if (avatarUrl && !newAvatarUrl) {
        throw new Error(messages.profile.errorAvatarUpdateFailed);
      }
      adminContext.updateProfile({ avatarUrl: newAvatarUrl });
      api.success({
        key,
        message: language === "zh-CN" ? "已保存" : "Saved",
        description: messages.profile.successAvatarUpdated,
        duration: 2.6,
      });
      setAvatarModalOpen(false);
    } catch (e) {
      api.error({
        key,
        message: messages.common.unknownError,
        description: e instanceof Error ? e.message : messages.common.unknownError,
        duration: 4,
      });
    }
  };

  const sendChangeEmailCode = async () => {
    const newEmail = String(emailForm.getFieldValue("newEmail") || "").trim();
    if (!newEmail) {
      api.warning({
        message: language === "zh-CN" ? "请先填写新邮箱" : "Please enter the new email",
        description: messages.profile.errorNewEmailRequired,
        duration: 3,
      });
      return;
    }

    const key = "admin-profile-send-code";
    setSendingCode(true);
    api.open({
      key,
      message: language === "zh-CN" ? "正在发送…" : "Sending…",
      description: language === "zh-CN" ? "验证码将发送到新邮箱" : "Code will be sent to the new email",
      duration: 0,
    });
    try {
      const res = await fetch("/api/email/send-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          purpose: "change-email",
          language,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(safeErrorFromResponse(res, text, messages.common.unknownError));
      }
      const data = (await res.json().catch(() => null)) as { challengeId?: string } | null;
      if (!data?.challengeId) throw new Error(messages.profile.errorSendCodeFailed);
      setEmailCodeChallengeId(String(data.challengeId));
      api.success({
        key,
        message: language === "zh-CN" ? "已发送" : "Sent",
        description: messages.profile.successCodeSent,
        duration: 3,
      });
    } catch (e) {
      api.error({
        key,
        message: messages.common.unknownError,
        description: e instanceof Error ? e.message : messages.common.unknownError,
        duration: 4,
      });
    } finally {
      setSendingCode(false);
    }
  };

  const doUpdateEmail = async (newEmail: string, emailCode: string) => {
    if (!adminEmail) return;
    if (!emailCodeChallengeId) {
      api.warning({
        message: language === "zh-CN" ? "请先获取验证码" : "Please send code first",
        description: language === "zh-CN" ? "需要先发送验证码并获取 challengeId" : "Send code to get a challengeId first",
        duration: 3,
      });
      return;
    }

    const key = "admin-profile-email";
    api.open({
      key,
      message: language === "zh-CN" ? "正在保存…" : "Saving…",
      description: language === "zh-CN" ? "正在修改邮箱" : "Updating email",
      duration: 0,
    });
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newEmail: newEmail.trim(),
          emailCode: emailCode.trim(),
          emailCodeChallengeId,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(safeErrorFromResponse(res, text, messages.common.unknownError));
      }

      api.success({
        key,
        message: language === "zh-CN" ? "已修改" : "Updated",
        description: messages.profile.successEmailUpdated,
        duration: 3,
      });

      setEmailModalOpen(false);
      setEmailCodeChallengeId("");

      if (typeof window !== "undefined") {
        // 修改邮箱后强制退出管理员登录，要求使用新邮箱重新登录
        adminContext.clearAdmin();
        try {
          await fetch("/api/logout", {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            keepalive: true,
          });
        } catch {
          // ignore
        } finally {
          window.location.replace("/admin/login");
        }
      }
    } catch (e) {
      api.error({
        key,
        message: messages.common.unknownError,
        description: e instanceof Error ? e.message : messages.common.unknownError,
        duration: 4,
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

  const roleTag =
    adminRole === "super_admin" ? (
      <Tag color="gold">{language === "zh-CN" ? "超级管理员" : "Super Admin"}</Tag>
    ) : adminRole === "admin" ? (
      <Tag color="blue">{language === "zh-CN" ? "管理员" : "Admin"}</Tag>
    ) : adminRole ? (
      <Tag>{adminRole}</Tag>
    ) : null;

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
                {messages.profile.title}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
                {language === "zh-CN" ? "当前管理员：" : "Current admin: "}
                {adminEmail}
              </Typography.Paragraph>
            </div>
          </Space>
          <Tabs
            items={[
              {
                key: "overview",
                label: language === "zh-CN" ? "基础信息" : "Profile",
                children: (
                  <Card>
                    <Space
                      align="start"
                      style={{ width: "100%", justifyContent: "space-between" }}
                      wrap
                    >
                      <Space align="center" size={12}>
                        <Avatar
                          size={56}
                          src={adminProfile?.avatarUrl || undefined}
                          className="app-avatar"
                        >
                          {(adminProfile?.username || adminEmail).trim().charAt(0).toUpperCase()}
                        </Avatar>
                        <div>
                          <Space size={8} wrap>
                            <Typography.Text strong style={{ fontSize: 16 }}>
                              {adminProfile?.username || "-"}
                            </Typography.Text>
                            {roleTag}
                          </Space>
                          <Typography.Text type="secondary">{adminEmail}</Typography.Text>
                        </div>
                      </Space>

                      <Space wrap>
                        <Button onClick={openUsernameModal}>{messages.profile.editUsername}</Button>
                        <Button onClick={openAvatarModal}>
                          {adminProfile?.avatarUrl ? messages.profile.changeAvatar : messages.profile.setAvatar}
                        </Button>
                      </Space>
                    </Space>

                    <Divider style={{ margin: "12px 0" }} />

                    <Descriptions
                      size={isMobile ? "small" : "middle"}
                      column={isMobile ? 1 : 2}
                      items={[
                        {
                          key: "email",
                          label: language === "zh-CN" ? "邮箱" : "Email",
                          children: <Typography.Text copyable>{adminEmail}</Typography.Text>,
                        },
                        {
                          key: "username",
                          label: language === "zh-CN" ? "用户名" : "Username",
                          children: adminProfile?.username || "-",
                        },
                        {
                          key: "role",
                          label: language === "zh-CN" ? "角色" : "Role",
                          children: roleTag ?? "-",
                        },
                      ]}
                    />
                  </Card>
                ),
              },
              {
                key: "security",
                label: language === "zh-CN" ? "安全设置" : "Security",
                children: (
                  <Card>
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      <Alert
                        type="info"
                        showIcon
                        message={language === "zh-CN" ? "安全提示" : "Security tip"}
                        description={
                          language === "zh-CN"
                            ? "修改邮箱后会自动退出登录，请使用新邮箱重新登录。"
                            : "After changing email, you will be signed out and need to sign in again."
                        }
                      />
                      <Space wrap>
                        <Button onClick={openEmailModal}>{messages.profile.emailSectionTitle}</Button>
                      </Space>
                    </Space>
                  </Card>
                ),
              },
              {
                key: "orders",
                label: language === "zh-CN" ? "订单截图" : "Order screenshots",
                children: (
                  <Card>
                    {ordersLoading ? (
                      <Typography.Text type="secondary">{messages.common.loading}</Typography.Text>
                    ) : orders.length === 0 ? (
                      <Typography.Text type="secondary">{messages.orders.emptyText}</Typography.Text>
                    ) : (
                      <Image.PreviewGroup>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                          {orders.map((o) => (
                            <div key={o.id} style={{ width: 140 }}>
                              <Image
                                src={o.imageUrl}
                                alt="order"
                                width={140}
                                height={96}
                                style={{ objectFit: "cover", borderRadius: 8 }}
                              />
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {new Date(o.createdAt).toLocaleDateString()}
                              </Typography.Text>
                              {o.deviceId ? (
                                <div title={o.deviceId}>
                                  <Typography.Text style={{ fontSize: 12 }} ellipsis>
                                    {o.deviceId}
                                  </Typography.Text>
                                </div>
                              ) : null}
                              {o.note ? (
                                <div title={o.note}>
                                  <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                                    {o.note}
                                  </Typography.Text>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </Image.PreviewGroup>
                    )}
                  </Card>
                ),
              },
            ]}
          />
        </Space>
      </div>

      <Modal
        title={messages.profile.usernameDialogTitle}
        open={usernameModalOpen}
        onCancel={() => setUsernameModalOpen(false)}
        onOk={() => {
          void usernameForm
            .validateFields()
            .then((v) => doUpdateUsername(v.username))
            .catch(() => undefined);
        }}
        okText={messages.profile.usernameDialogSave}
        cancelText={messages.profile.usernameDialogCancel}
      >
        <Form form={usernameForm} layout="vertical" requiredMark="optional">
          <Form.Item
            label={language === "zh-CN" ? "用户名" : "Username"}
            name="username"
            rules={[
              { required: true, message: messages.profile.errorUsernameUpdateFailed },
              { max: 50, message: language === "zh-CN" ? "最多 50 个字符" : "Max 50 chars" },
            ]}
          >
            <Input autoComplete="off" maxLength={50} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={messages.profile.avatarDialogTitle}
        open={avatarModalOpen}
        onCancel={() => setAvatarModalOpen(false)}
        onOk={() => {
          void avatarForm
            .validateFields()
            .then((v) => {
              const url = v.avatarUrl?.trim();
              void doUpdateAvatar(url ? url : null);
            })
            .catch(() => undefined);
        }}
        okText={messages.profile.avatarDialogSave}
        cancelText={messages.profile.avatarDialogCancel}
        okButtonProps={{ disabled: avatarUploading }}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            {messages.profile.avatarDialogDesc}
          </Typography.Paragraph>

          <Space align="center" size={12}>
            <Avatar size={48} src={avatarPreviewUrl || undefined} className="app-avatar">
              {(adminProfile?.username || adminEmail).trim().charAt(0).toUpperCase()}
            </Avatar>
            <Upload
              accept="image/*"
              multiple={false}
              showUploadList={false}
              fileList={avatarFileList}
              beforeUpload={(file) => {
                if (file.size > 2 * 1024 * 1024) {
                  api.error({
                    message: language === "zh-CN" ? "文件过大" : "File too large",
                    description: messages.profile.errorAvatarTooLarge,
                    duration: 3.5,
                  });
                  return Upload.LIST_IGNORE;
                }
                return true;
              }}
              customRequest={async (options) => {
                const file = options.file as File;
                setAvatarUploading(true);
                const key = "admin-profile-avatar-upload";
                api.open({
                  key,
                  message: language === "zh-CN" ? "正在上传…" : "Uploading…",
                  description: language === "zh-CN" ? "正在上传头像到服务器" : "Uploading avatar",
                  duration: 0,
                });
                try {
                  const formData = new FormData();
                  formData.append("file", file);
                  const res = await fetch("/api/avatar/upload", {
                    method: "POST",
                    credentials: "include",
                    body: formData,
                  });
                  if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(safeErrorFromResponse(res, text, messages.common.unknownError));
                  }
                  const data = (await res.json().catch(() => null)) as
                    | { dbUrl?: string; publicUrl?: string }
                    | null;
                  if (!data?.dbUrl) throw new Error(messages.profile.errorAvatarUpdateFailed);
                  avatarForm.setFieldsValue({ avatarUrl: data.dbUrl });
                  setAvatarPreviewUrl(typeof data.publicUrl === "string" ? data.publicUrl : null);
                  api.success({
                    key,
                    message: language === "zh-CN" ? "上传成功" : "Uploaded",
                    description: language === "zh-CN" ? "请点击“保存”完成更新" : "Click “Save” to apply",
                    duration: 2.6,
                  });
                  options.onSuccess?.(data, res as unknown as XMLHttpRequest);
                } catch (e) {
                  api.error({
                    key,
                    message: messages.common.unknownError,
                    description: e instanceof Error ? e.message : messages.common.unknownError,
                    duration: 4,
                  });
                  options.onError?.(e as Error);
                } finally {
                  setAvatarUploading(false);
                }
              }}
            >
              <Button loading={avatarUploading}>
                {language === "zh-CN" ? "上传头像" : "Upload"}
              </Button>
            </Upload>

            <Button
              danger
              onClick={() => {
                avatarForm.setFieldsValue({ avatarUrl: "" });
                setAvatarPreviewUrl(null);
                setAvatarFileList([]);
              }}
            >
              {language === "zh-CN" ? "清除" : "Clear"}
            </Button>
          </Space>

          <Form form={avatarForm} layout="vertical" requiredMark="optional">
            <Form.Item
              label={language === "zh-CN" ? "头像地址（可选）" : "Avatar URL (optional)"}
              name="avatarUrl"
              tooltip={language === "zh-CN" ? "留空保存将清除头像" : "Leave empty to clear"}
              rules={[{ max: 500, message: language === "zh-CN" ? "最长 500 字符" : "Max 500 chars" }]}
            >
              <Input placeholder="https://example.com/avatar.png" maxLength={500} />
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      <Modal
        title={messages.profile.emailDialogTitle}
        open={emailModalOpen}
        onCancel={() => {
          setEmailModalOpen(false);
          setEmailCodeChallengeId("");
        }}
        onOk={() => {
          void emailForm
            .validateFields()
            .then((v) => doUpdateEmail(v.newEmail, v.emailCode))
            .catch(() => undefined);
        }}
        okText={messages.profile.emailDialogConfirm}
        cancelText={messages.profile.emailDialogCancel}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Alert type="warning" showIcon message={messages.profile.emailDialogDesc} />
          <Form form={emailForm} layout="vertical" requiredMark="optional">
            <Form.Item
              label={messages.profile.emailNewPlaceholder}
              name="newEmail"
              rules={[
                { required: true, message: messages.profile.errorNewEmailRequired },
                { type: "email", message: language === "zh-CN" ? "邮箱格式不正确" : "Invalid email" },
              ]}
            >
              <Input placeholder={messages.profile.emailNewPlaceholder} />
            </Form.Item>
            <Form.Item
              label={messages.profile.emailCodePlaceholder}
              name="emailCode"
              rules={[{ required: true, message: messages.profile.errorUpdateEmailFieldsRequired }]}
            >
              <Space.Compact style={{ width: "100%" }}>
                <Input placeholder={messages.profile.emailCodePlaceholder} />
                <Button onClick={sendChangeEmailCode} loading={sendingCode}>
                  {messages.profile.emailSendCode}
                </Button>
              </Space.Compact>
            </Form.Item>
          </Form>
        </Space>
      </Modal>

    </ConfigProvider>
  );
}
