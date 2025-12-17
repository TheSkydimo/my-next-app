"use client";

import { useEffect, useState } from "react";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getAdminMessages } from "../../admin-i18n";

type Profile = {
  username: string;
  email: string;
  avatarUrl: string | null;
};

function PasswordField({
  value,
  onChange,
  placeholder,
  showLabel,
  hideLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  showLabel: string;
  hideLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        style={{
          minWidth: 64,
          background: "#e5e7eb",
          borderColor: "#d1d5db",
          color: "#111827",
        }}
      >
        {visible ? hideLabel : showLabel}
      </button>
    </div>
  );
}

export default function AdminProfilePage() {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [editing, setEditing] = useState(false);

  const [usernameInput, setUsernameInput] = useState("");
  const [avatarUrlInput, setAvatarUrlInput] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [emailOldPassword, setEmailOldPassword] = useState("");
  const [emailNewPassword, setEmailNewPassword] = useState("");
  const [emailConfirmNewPassword, setEmailConfirmNewPassword] = useState("");
  const [orders, setOrders] = useState<
    {
      id: number;
      deviceId: string;
      imageUrl: string;
      note: string | null;
      createdAt: string;
    }[]
  >([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  const messages = getAdminMessages(language);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isAdmin = window.localStorage.getItem("isAdmin");
      const email = window.localStorage.getItem("adminEmail");
      if (isAdmin === "true" && email) {
        setAdminEmail(email);
      }
    }
  }, []);

  const loadProfile = async (email: string) => {
    setLoading(true);
    setError("");
    setOkMsg("");
    try {
      const res = await fetch(`/api/user/profile?email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.profile.errorProfileLoadFailed);
      }
      const data = (await res.json()) as {
        username: string;
        email: string;
        avatarUrl: string | null;
      };
      setProfile({
        username: data.username,
        email: data.email,
        avatarUrl: data.avatarUrl,
      });
      setUsernameInput(data.username);
      setAvatarUrlInput(data.avatarUrl ?? "");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : messages.profile.errorProfileLoadFailed
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminEmail) return;

    loadProfile(adminEmail);

    const loadOrders = async (email: string) => {
      setOrdersLoading(true);
      try {
        const params = new URLSearchParams({
          adminEmail: email,
          userEmail: email,
        });
        const res = await fetch(`/api/admin/orders?${params.toString()}`);
        if (!res.ok) {
          // 管理员订单截图加载失败，不阻塞资料页
          return;
        }
        const data = (await res.json()) as {
          items: {
            id: number;
            userEmail: string;
            deviceId: string;
            imageUrl: string;
            note: string | null;
            createdAt: string;
          }[];
        };
        setOrders(
          data.items.map((o) => ({
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

    loadOrders(adminEmail);
  }, [adminEmail]);

  const updateUsername = async () => {
    if (!adminEmail || !usernameInput) return;
    setError("");
    setOkMsg("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail,
          username: usernameInput,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.profile.errorUsernameUpdateFailed);
      }
      setOkMsg(messages.profile.successUsernameUpdated);
      setProfile((p) =>
        p
          ? { ...p, username: usernameInput }
          : { username: usernameInput, email: adminEmail, avatarUrl: null }
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : messages.profile.errorUsernameUpdateFailed
      );
    }
  };

  const updateAvatar = async () => {
    if (!adminEmail) return;
    setError("");
    setOkMsg("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail,
          avatarUrl: avatarUrlInput.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.profile.errorAvatarUpdateFailed);
      }
      setOkMsg(messages.profile.successAvatarUpdated);
      setProfile((p) =>
        p
          ? { ...p, avatarUrl: avatarUrlInput.trim() || null }
          : {
              username: usernameInput || "",
              email: adminEmail,
              avatarUrl: avatarUrlInput.trim() || null,
            }
      );

      if (typeof window !== "undefined") {
        if (avatarUrlInput.trim()) {
          window.localStorage.setItem("adminAvatarUrl", avatarUrlInput.trim());
        } else {
          window.localStorage.removeItem("adminAvatarUrl");
        }

        // 通知布局更新右上角管理员头像
        window.dispatchEvent(
          new CustomEvent("admin-avatar-updated", {
            detail: {
              avatarUrl: avatarUrlInput.trim() || null,
              displayName: profile?.username ?? usernameInput ?? null,
            },
          })
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : messages.profile.errorAvatarUpdateFailed
      );
    }
  };

  const updatePassword = async () => {
    if (!adminEmail) return;
    setError("");
    setOkMsg("");

    if (!oldPassword || !newPassword || !confirmNewPassword) {
      setError(messages.profile.errorPasswordFieldsRequired);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError(messages.profile.errorPasswordNotMatch);
      return;
    }

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail,
          oldPassword,
          newPassword,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.profile.errorPasswordUpdateFailed);
      }
      setOkMsg(messages.profile.successPasswordUpdated);
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : messages.profile.errorPasswordUpdateFailed
      );
    }
  };

  const sendChangeEmailCode = async () => {
    if (!newEmail) {
      setError(messages.profile.errorNewEmailRequired);
      return;
    }
    setError("");
    setOkMsg("");
    setSendingCode(true);
    try {
      const res = await fetch("/api/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          purpose: "change-email",
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.profile.errorSendCodeFailed);
      }
      setOkMsg(messages.profile.successCodeSent);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : messages.profile.errorSendCodeFailed
      );
    } finally {
      setSendingCode(false);
    }
  };

  const updateEmail = async () => {
    if (!adminEmail) return;
    if (!newEmail || !emailCode) {
      setError(messages.profile.errorUpdateEmailFieldsRequired);
      return;
    }

    if (!emailOldPassword || !emailNewPassword || !emailConfirmNewPassword) {
      setError(messages.profile.errorUpdateEmailPasswordFieldsRequired);
      return;
    }

    if (emailNewPassword !== emailConfirmNewPassword) {
      setError(messages.profile.errorUpdateEmailPasswordNotMatch);
      return;
    }

    setError("");
    setOkMsg("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail,
          oldPassword: emailOldPassword,
          newPassword: emailNewPassword,
          newEmail,
          emailCode,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.profile.errorUpdateEmailFailed);
      }
      setOkMsg(messages.profile.successEmailUpdated);
      setEmailOldPassword("");
      setEmailNewPassword("");
      setEmailConfirmNewPassword("");
      setNewEmail("");
      setEmailCode("");

      if (typeof window !== "undefined") {
        // 修改邮箱后强制退出管理员登录，要求使用新邮箱重新登录
        window.localStorage.removeItem("adminEmail");
        window.localStorage.removeItem("isAdmin");
        setTimeout(() => {
          window.location.href = "/admin/login";
        }, 1200);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : messages.profile.errorUpdateEmailFailed
      );
    }
  };

  if (!adminEmail) {
    return (
      <div style={{ maxWidth: 640, margin: "10px auto" }}>
        <p>{messages.common.adminLoginRequired}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "10px auto" }}>
      {loading && <p>{messages.common.loading}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {okMsg && <p style={{ color: "green" }}>{okMsg}</p>}

      {profile && (
        <>
          <section style={{ marginTop: 24 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginTop: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "9999px",
                    overflow: "hidden",
                    border: "1px solid #e5e7eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f9fafb",
                    fontSize: 12,
                    color: "#9ca3af",
                  }}
                >
                  {profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatarUrl}
                      alt="avatar"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span>{messages.profile.avatarNone}</span>
                  )}
                </div>
                {editing && (
                  <button
                    type="button"
                    className="user-profile-button user-profile-button--tertiary"
                    onClick={() => {
                      setError("");
                      setOkMsg("");
                      setAvatarUrlInput(profile.avatarUrl ?? "");
                      setShowAvatarDialog(true);
                    }}
                  >
                    {profile.avatarUrl ? "更换头像" : "设置头像"}
                  </button>
                )}
              </div>
              <label style={{ fontSize: 14 }}>
                {messages.profile.currentEmail}
                <strong>{profile.email}</strong>
              </label>
              <label
                style={{ fontSize: 14, cursor: editing ? "pointer" : "default" }}
                className={editing ? "user-profile-inline-edit" : undefined}
                onClick={
                  editing
                    ? () => {
                        setError("");
                        setOkMsg("");
                        setUsernameInput(profile.username);
                        setShowUsernameDialog(true);
                      }
                    : undefined
                }
              >
                {messages.profile.username}
                <strong>{profile.username}</strong>
              </label>
            </div>
          </section>

          {showAvatarDialog && (
            <div className="dialog-overlay">
              <div className="dialog-card">
                <h3 className="dialog-card__title">
                  {messages.profile.avatarDialogTitle}
                </h3>
                <p className="dialog-card__desc dialog-card__desc--muted">
                  {messages.profile.avatarDialogDesc}
                </p>
                <div className="dialog-card__body">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      if (file.size > 300 * 1024) {
                        setError(messages.profile.errorAvatarTooLarge);
                        return;
                      }

                      const reader = new FileReader();
                      reader.onload = () => {
                        const result = reader.result;
                        if (typeof result === "string") {
                          setAvatarUrlInput(result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <input
                    placeholder="https://example.com/avatar.png"
                    value={avatarUrlInput}
                    onChange={(e) => setAvatarUrlInput(e.target.value)}
                  />
                </div>
                <div className="dialog-card__actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAvatarDialog(false);
                      setAvatarUrlInput(profile.avatarUrl ?? "");
                    }}
                  className="dialog-card__cancel"
                  >
                    {messages.profile.avatarDialogCancel}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateAvatar();
                      setShowAvatarDialog(false);
                    }}
                  className="dialog-card__primary"
                  >
                    {messages.profile.avatarDialogSave}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showUsernameDialog && (
            <div className="dialog-overlay">
              <div className="dialog-card">
                <h3 className="dialog-card__title">
                  {messages.profile.usernameDialogTitle}
                </h3>
                <div className="dialog-card__body">
                  <input
                    placeholder={messages.profile.username}
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                  />
                </div>
                <div className="dialog-card__actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUsernameDialog(false);
                      setUsernameInput(profile.username);
                    }}
                  className="dialog-card__cancel"
                  >
                    {messages.profile.usernameDialogCancel}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateUsername();
                      setShowUsernameDialog(false);
                    }}
                  className="dialog-card__primary"
                  >
                    {messages.profile.usernameDialogSave}
                  </button>
                </div>
              </div>
            </div>
          )}

          {editing && (
            <section style={{ marginTop: 32 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 8,
                }}
              >
                <h2 style={{ fontSize: 16 }}>
                  {messages.profile.passwordSectionTitle}
                </h2>
                <button
                  type="button"
                  className="user-profile-button user-profile-button--tertiary user-profile-inline-link"
                  onClick={() => {
                    setError("");
                    setOkMsg("");
                    setShowPasswordDialog(true);
                  }}
                >
                  {messages.profile.passwordSectionEdit}
                </button>
              </div>
            </section>
          )}

          {showPasswordDialog && (
            <div className="dialog-overlay">
              <div className="dialog-card">
                <h3 className="dialog-card__title">
                  {messages.profile.passwordDialogTitle}
                </h3>
                <div className="dialog-card__body">
                  <PasswordField
                    placeholder={messages.profile.passwordOldPlaceholder}
                    value={oldPassword}
                    onChange={setOldPassword}
                    showLabel={messages.profile.showPassword}
                    hideLabel={messages.profile.hidePassword}
                  />
                  <PasswordField
                    placeholder={messages.profile.passwordNewPlaceholder}
                    value={newPassword}
                    onChange={setNewPassword}
                    showLabel={messages.profile.showPassword}
                    hideLabel={messages.profile.hidePassword}
                  />
                  <PasswordField
                    placeholder={messages.profile.passwordConfirmPlaceholder}
                    value={confirmNewPassword}
                    onChange={setConfirmNewPassword}
                    showLabel={messages.profile.showPassword}
                    hideLabel={messages.profile.hidePassword}
                  />
                </div>
                <div className="dialog-card__actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordDialog(false);
                      setOldPassword("");
                      setNewPassword("");
                      setConfirmNewPassword("");
                    }}
                  className="dialog-card__cancel"
                  >
                    {messages.profile.passwordDialogCancel}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updatePassword();
                      setShowPasswordDialog(false);
                    }}
                  className="dialog-card__primary"
                  >
                    {messages.profile.passwordDialogConfirm}
                  </button>
                </div>
              </div>
            </div>
          )}

          {editing && (
            <section style={{ marginTop: 32 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 8,
                }}
              >
                <h2 style={{ fontSize: 16 }}>
                  {messages.profile.emailSectionTitle}
                </h2>
                <button
                  type="button"
                  className="user-profile-button user-profile-button--tertiary user-profile-inline-link"
                  onClick={() => {
                    setError("");
                    setOkMsg("");
                    setShowEmailDialog(true);
                  }}
                >
                  {messages.profile.emailSectionEdit}
                </button>
              </div>
            </section>
          )}

          {/* 底部统一的“更新信息”主按钮，控制是否进入编辑模式 */}
          <section style={{ marginTop: 40 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 8,
              }}
            >
              <button
                type="button"
                className="user-profile-button user-profile-button--primary user-profile-button--compact"
                onClick={() => setEditing((prev) => !prev)}
              >
                {editing
                  ? messages.profile.finishUpdateInfo
                  : messages.profile.updateInfo}
              </button>
            </div>
          </section>

          <section style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              {language === "zh-CN" ? "我上传的订单截图" : "My order screenshots"}
            </h2>
            {ordersLoading ? (
              <p style={{ fontSize: 14, color: "#6b7280" }}>
                {messages.common.loading}
              </p>
            ) : orders.length === 0 ? (
              <p style={{ fontSize: 14, color: "#6b7280" }}>
                {messages.orders.emptyText}
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  marginTop: 4,
                }}
              >
                {orders.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      width: 120,
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      padding: 6,
                      backgroundColor: "#f9fafb",
                      fontSize: 11,
                      color: "#4b5563",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewUrl(o.imageUrl)}
                      style={{
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        cursor: "zoom-in",
                        display: "block",
                        width: "100%",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={o.imageUrl}
                        alt="order"
                        style={{
                          width: "100%",
                          height: 80,
                          objectFit: "cover",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                        }}
                      />
                    </button>
                    <div
                      style={{
                        marginTop: 4,
                        color: "#6b7280",
                      }}
                    >
                      {new Date(o.createdAt).toLocaleDateString()}
                    </div>
                    {o.deviceId && (
                      <div
                        style={{
                          marginTop: 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={o.deviceId}
                      >
                        {o.deviceId}
                      </div>
                    )}
                    {o.note && (
                      <div
                        style={{
                          marginTop: 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={o.note}
                      >
                        {o.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {showEmailDialog && (
            <div className="dialog-overlay">
              <div className="dialog-card">
                <h3 className="dialog-card__title">
                  {messages.profile.emailDialogTitle}
                </h3>
                <p className="dialog-card__desc dialog-card__desc--warn">
                  {messages.profile.emailDialogDesc}
                </p>
                <div className="dialog-card__body">
                  <input
                    type="email"
                    placeholder={messages.profile.emailNewPlaceholder}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      placeholder={messages.profile.emailCodePlaceholder}
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={sendChangeEmailCode}
                      disabled={sendingCode}
                    >
                      {sendingCode
                        ? messages.profile.emailSendingCode
                        : messages.profile.emailSendCode}
                    </button>
                  </div>
                  <PasswordField
                    placeholder={messages.profile.emailOldPasswordPlaceholder}
                    value={emailOldPassword}
                    onChange={setEmailOldPassword}
                    showLabel={messages.profile.showPassword}
                    hideLabel={messages.profile.hidePassword}
                  />
                  <PasswordField
                    placeholder={messages.profile.emailNewPasswordPlaceholder}
                    value={emailNewPassword}
                    onChange={setEmailNewPassword}
                    showLabel={messages.profile.showPassword}
                    hideLabel={messages.profile.hidePassword}
                  />
                  <PasswordField
                    placeholder={
                      messages.profile.emailConfirmNewPasswordPlaceholder
                    }
                    value={emailConfirmNewPassword}
                    onChange={setEmailConfirmNewPassword}
                    showLabel={messages.profile.showPassword}
                    hideLabel={messages.profile.hidePassword}
                  />
                </div>
                <div className="dialog-card__actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmailDialog(false);
                      setNewEmail("");
                      setEmailCode("");
                      setEmailOldPassword("");
                      setEmailNewPassword("");
                      setEmailConfirmNewPassword("");
                    }}
                  className="dialog-card__cancel"
                  >
                    {messages.profile.emailDialogCancel}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateEmail();
                      setShowEmailDialog(false);
                    }}
                  className="dialog-card__primary"
                  >
                    {messages.profile.emailDialogConfirm}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              backgroundColor: "#111827",
              padding: 12,
              borderRadius: 8,
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            }}
          >
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              style={{
                display: "block",
                marginLeft: "auto",
                marginBottom: 8,
                background: "transparent",
                border: "none",
                color: "#e5e7eb",
                fontSize: 20,
                cursor: "pointer",
              }}
              aria-label="关闭预览"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="order-preview"
              style={{
                maxWidth: "100%",
                maxHeight: "80vh",
                objectFit: "contain",
                borderRadius: 6,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}


