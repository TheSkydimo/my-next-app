"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Avatar,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Modal,
  Space,
  Typography,
  Upload,
  message,
  Descriptions,
  Spin,
  Alert,
  Tabs,
  Grid,
} from "antd";
import type { UploadFile } from "antd";
import {
  UserOutlined,
} from "@ant-design/icons";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getUserMessages } from "../../user-i18n";
import { useUser } from "../../contexts/UserContext";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type Profile = {
  username: string;
  email: string;
  avatarUrl: string | null;
};

export default function UserProfilePage() {
  const userContext = useUser();
  const userEmail = userContext.profile?.email ?? null;
  const isUserInitialized = userContext.initialized;
  
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [language, setLanguage] = useState<AppLanguage>(() =>
    getInitialLanguage()
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  
  // Modals state
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  
  // Forms
  const [usernameForm] = Form.useForm();
  const [emailForm] = Form.useForm();
  const [avatarForm] = Form.useForm();

  // Loading states
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  // Avatar Preview
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarFileList, setAvatarFileList] = useState<UploadFile[]>([]);

  // Email verification state
  const [emailCodeChallengeId, setEmailCodeChallengeId] = useState("");

  const [messageApi, contextHolder] = message.useMessage();

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

  const messages = getUserMessages(language);

  // Initialize profile from context
  useEffect(() => {
    if (userContext.profile && !profile) {
      const { username, email, avatarUrl } = userContext.profile;
      setProfile({ username, email, avatarUrl });
      usernameForm.setFieldValue("username", username);
      avatarForm.setFieldValue("avatarUrl", avatarUrl ?? "");
    }
  }, [userContext.profile, profile, usernameForm, avatarForm]);

  // Handlers
  const openUsernameModal = () => {
    usernameForm.setFieldsValue({ username: profile?.username ?? "" });
    setIsUsernameModalOpen(true);
  };

  const openAvatarModal = () => {
    setAvatarFileList([]);
    setAvatarPreviewUrl(profile?.avatarUrl ?? null);
    avatarForm.setFieldsValue({ avatarUrl: profile?.avatarUrl ?? "" });
    setIsAvatarModalOpen(true);
  };

  const openEmailModal = () => {
    emailForm.resetFields();
    setEmailCodeChallengeId("");
    setIsEmailModalOpen(true);
  };

  const handleUpdateUsername = async () => {
    try {
      const values = await usernameForm.validateFields();
      if (!userEmail) return;

      setUsernameLoading(true);
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: values.username,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.profile.errorUsernameUpdateFailed);
      }

      messageApi.success(messages.profile.successUsernameUpdated);
      setProfile((p) =>
        p
          ? { ...p, username: values.username }
          : { username: values.username, email: userEmail, avatarUrl: null }
      );
      userContext.updateProfile({ username: values.username });
      setIsUsernameModalOpen(false);
    } catch (e) {
      messageApi.error(
        e instanceof Error
          ? e.message
          : messages.profile.errorUsernameUpdateFailed
      );
    } finally {
      setUsernameLoading(false);
    }
  };

  const doUpdateAvatar = async (avatarUrl: string | null) => {
    if (!userEmail) return;
    setAvatarLoading(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.profile.errorAvatarUpdateFailed);
      }

      const data = (await res.json().catch(() => null)) as { avatarUrl?: string | null } | null;
      const newAvatarUrl = typeof data?.avatarUrl === "string" ? data.avatarUrl : null;

      if (avatarUrl && !newAvatarUrl) {
        throw new Error(messages.profile.errorAvatarUpdateFailed);
      }

      setProfile((p) =>
        p
          ? { ...p, avatarUrl: newAvatarUrl }
          : { username: profile?.username || "", email: userEmail, avatarUrl: newAvatarUrl }
      );
      userContext.updateProfile({ avatarUrl: newAvatarUrl });
      messageApi.success(messages.profile.successAvatarUpdated);
      setIsAvatarModalOpen(false);
    } catch (e) {
      messageApi.error(
        e instanceof Error ? e.message : messages.profile.errorAvatarUpdateFailed
      );
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleSendCode = async () => {
    try {
      const email = emailForm.getFieldValue("newEmail");
      if (!email) {
        messageApi.error(messages.profile.errorNewEmailRequired);
        return;
      }
      
      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
         messageApi.error("Please enter a valid email address");
         return;
      }

      setSendingCode(true);
      const res = await fetch("/api/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          purpose: "change-email",
          language,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.profile.errorSendCodeFailed);
      }

      const data = (await res.json().catch(() => null)) as
        | { challengeId?: string }
        | null;

      if (!data?.challengeId) {
        throw new Error(messages.profile.errorSendCodeFailed);
      }

      setEmailCodeChallengeId(String(data.challengeId));
      messageApi.success(messages.profile.successCodeSent);
    } catch (e) {
      messageApi.error(
        e instanceof Error ? e.message : messages.profile.errorSendCodeFailed
      );
    } finally {
      setSendingCode(false);
    }
  };

  const handleUpdateEmail = async () => {
    try {
      const values = await emailForm.validateFields();
      if (!userEmail) return;

      setEmailLoading(true);
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newEmail: values.newEmail,
          emailCode: values.emailCode,
          emailCodeChallengeId,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.profile.errorUpdateEmailFailed);
      }

      messageApi.success(messages.profile.successEmailUpdated);
      setIsEmailModalOpen(false);
      emailForm.resetFields();
      setEmailCodeChallengeId("");

      // Logout logic
      if (typeof window !== "undefined") {
        try {
          await fetch("/api/logout", { method: "POST" });
        } catch {
          // ignore
        }
        setTimeout(() => {
          window.location.href = "/login";
        }, 1200);
      }
    } catch (e) {
      messageApi.error(
        e instanceof Error ? e.message : messages.profile.errorUpdateEmailFailed
      );
    } finally {
      setEmailLoading(false);
    }
  };

  if (!isUserInitialized) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="vben-page">
        <Card style={{ maxWidth: 820, margin: "0 auto" }}>
           <Typography.Title level={4}>{messages.common.loginRequired}</Typography.Title>
           <Link href="/login">
             <Button type="primary">{messages.common.goLogin}</Button>
           </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="vben-page">
      {contextHolder}
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        
        {/* Header Area */}
        <Space
          align="start"
          style={{ width: "100%", justifyContent: "space-between" }}
          wrap
        >
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {messages.profile.title || "个人资料"}
            </Title>
            <Text type="secondary" style={{ marginTop: 4, display: "block" }}>
              {messages.profile.currentEmail}
              {language === "zh-CN" ? "：" : ": "}
              {userEmail}
            </Text>
          </div>
          <Link href="/">
             <Button>{language === "zh-CN" ? "返回首页" : "Back Home"}</Button>
          </Link>
        </Space>

        <Tabs
          items={[
            {
              key: "overview",
              label: language === "zh-CN" ? "基础信息" : "Overview",
              children: (
                <Card>
                  {profile && (
                    <>
                      <Space
                        align="start"
                        style={{ width: "100%", justifyContent: "space-between" }}
                        wrap
                      >
                        <Space align="start" size={12}>
                          <Avatar
                            size={56}
                            src={profile.avatarUrl}
                            icon={<UserOutlined />}
                            style={{ backgroundColor: '#1677ff' }}
                          />
                          <div>
                             <Space size={8} wrap>
                                <Text strong style={{ fontSize: 16 }}>{profile.username}</Text>
                             </Space>
                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <Text type="secondary">{profile.email}</Text>
                             </div>
                          </div>
                        </Space>
                        
                        <Space wrap>
                          <Button onClick={openUsernameModal}>{messages.profile.editUsername}</Button>
                          <Button onClick={openAvatarModal}>
                             {profile.avatarUrl ? messages.profile.changeAvatar : messages.profile.setAvatar}
                          </Button>
                        </Space>
                      </Space>

                      <Divider style={{ margin: "12px 0" }} />

                      <Descriptions
                        column={1}
                        size={isMobile ? "small" : "middle"}
                        items={[
                          {
                            key: 'email',
                            label: messages.profile.currentEmail,
                            children: <Text copyable>{profile.email}</Text>,
                          },
                          {
                            key: 'username',
                            label: messages.profile.username,
                            children: profile.username,
                          }
                        ]}
                      />
                    </>
                  )}
                </Card>
              )
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
                      description={messages.profile.emailDialogDesc}
                    />
                    <Space wrap>
                      <Button onClick={openEmailModal}>{messages.profile.emailSectionTitle}</Button>
                    </Space>
                  </Space>
                </Card>
              )
            }
          ]}
        />

      </Space>

      {/* Username Modal */}
      <Modal
        title={messages.profile.usernameDialogTitle}
        open={isUsernameModalOpen}
        onOk={handleUpdateUsername}
        onCancel={() => setIsUsernameModalOpen(false)}
        confirmLoading={usernameLoading}
      >
        <Form form={usernameForm} layout="vertical">
          <Form.Item
            name="username"
            label={messages.profile.username}
            rules={[{ required: true, message: messages.profile.username + " is required" }]}
          >
            <Input placeholder={messages.profile.username} maxLength={50} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Avatar Modal - Matches Admin Style */}
      <Modal
        title={messages.profile.avatarDialogTitle}
        open={isAvatarModalOpen}
        onCancel={() => setIsAvatarModalOpen(false)}
        onOk={() => {
           void avatarForm.validateFields().then(v => {
             const url = v.avatarUrl?.trim();
             void doUpdateAvatar(url || null);
           }).catch(() => {});
        }}
        confirmLoading={avatarLoading}
        okText={messages.profile.avatarDialogSave}
        cancelText={messages.profile.avatarDialogCancel}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
           <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              {messages.profile.avatarDialogDesc}
           </Typography.Paragraph>
           <Space align="center" size={12}>
              <Avatar size={48} src={avatarPreviewUrl} icon={<UserOutlined />} />
              <Upload
                accept="image/*"
                showUploadList={false}
                fileList={avatarFileList}
                beforeUpload={(file) => {
                  if (file.size > 2 * 1024 * 1024) {
                    messageApi.error(messages.profile.errorAvatarTooLarge);
                    return Upload.LIST_IGNORE;
                  }
                  return true;
                }}
                customRequest={async (options) => {
                  const file = options.file as File;
                  setAvatarLoading(true);
                  try {
                    const formData = new FormData();
                    formData.append("file", file);
                    const res = await fetch("/api/avatar/upload", {
                       method: "POST",
                       body: formData
                    });
                    if(!res.ok) throw new Error("Upload failed");
                    const data = (await res.json()) as { dbUrl?: string; publicUrl?: string };
                    if(data.dbUrl) {
                       avatarForm.setFieldValue("avatarUrl", data.dbUrl);
                       setAvatarPreviewUrl(data.publicUrl || data.dbUrl);
                       messageApi.success(language === "zh-CN" ? "上传成功，请点击保存" : "Uploaded, click Save to apply");
                       options.onSuccess?.(data);
                    }
                  } catch(e) {
                     messageApi.error(messages.profile.errorAvatarUpdateFailed);
                     options.onError?.(e as Error);
                  } finally {
                     setAvatarLoading(false);
                  }
                }}
              >
                 <Button loading={avatarLoading} icon={<UserOutlined />}>
                   {language === "zh-CN" ? "上传图片" : "Upload Image"}
                 </Button>
              </Upload>
              <Button danger onClick={() => {
                 avatarForm.setFieldValue("avatarUrl", "");
                 setAvatarPreviewUrl(null);
              }}>
                 {language === "zh-CN" ? "清除" : "Clear"}
              </Button>
           </Space>
           <Form form={avatarForm} layout="vertical">
              <Form.Item
                label={language === "zh-CN" ? "头像地址（可选）" : "Avatar URL (optional)"}
                name="avatarUrl"
              >
                 <Input placeholder="https://example.com/avatar.png" onChange={(e) => setAvatarPreviewUrl(e.target.value)} />
              </Form.Item>
           </Form>
        </Space>
      </Modal>

      {/* Email Modal */}
      <Modal
        title={messages.profile.emailDialogTitle}
        open={isEmailModalOpen}
        onOk={handleUpdateEmail}
        onCancel={() => {
          setIsEmailModalOpen(false);
          emailForm.resetFields();
        }}
        confirmLoading={emailLoading}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert type="warning" showIcon message={messages.profile.emailDialogDesc} />
          <Form form={emailForm} layout="vertical">
            <Form.Item
              name="newEmail"
              label={messages.profile.emailNewPlaceholder}
              rules={[
                { required: true, message: messages.profile.errorNewEmailRequired },
                { type: 'email', message: 'Please enter a valid email' }
              ]}
            >
               <Input placeholder={messages.profile.emailNewPlaceholder} />
            </Form.Item>
            
            <Form.Item
              label={messages.profile.emailCodePlaceholder}
              required
              style={{ marginBottom: 0 }}
            >
              <Space.Compact style={{ width: "100%" }}>
                  <Form.Item
                    name="emailCode"
                    noStyle
                    rules={[{ required: true, message: 'Please enter verification code' }]}
                  >
                    <Input placeholder={messages.profile.emailCodePlaceholder} />
                  </Form.Item>
                  <Button 
                    onClick={handleSendCode} 
                    loading={sendingCode}
                  >
                    {sendingCode ? messages.profile.emailSendingCode : messages.profile.emailSendCode}
                  </Button>
              </Space.Compact>
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </div>
  );
}
