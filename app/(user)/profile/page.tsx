"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getUserMessages } from "../../user-i18n";
import { useUser } from "../../contexts/UserContext";
import { useAutoDismissMessage } from "../../hooks/useAutoDismissMessage";

type Profile = {
  username: string;
  email: string;
  avatarUrl: string | null;
};

export default function UserProfilePage() {
  // 使用 UserContext 获取预加载的用户信息，避免重复请求
  const userContext = useUser();
  const userEmail = userContext.profile?.email ?? null;
  const isUserInitialized = userContext.initialized;
  
  const [language, setLanguage] = useState<AppLanguage>("zh-CN");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useAutoDismissMessage(2000);
  const [okMsg, setOkMsg] = useAutoDismissMessage(2000);
  const [editing, setEditing] = useState(false);

  const [usernameInput, setUsernameInput] = useState("");

  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

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

  const messages = getUserMessages(language);

  // 使用 UserContext 中的预加载数据初始化 profile 状态
  useEffect(() => {
    if (userContext.profile && !profile) {
      const { username, email, avatarUrl } = userContext.profile;
      setProfile({ username, email, avatarUrl });
      setUsernameInput(username);
      setAvatarUrlInput(avatarUrl ?? "");
    }
  }, [userContext.profile, profile]);

  // 当 UserContext 的 loading 状态变化时，同步到本地 loading 状态
  useEffect(() => {
    // 只在 context 初始化过程中同步 loading 状态
    if (!userContext.initialized) {
      setLoading(userContext.loading);
    }
  }, [userContext.loading, userContext.initialized]);

  const updateUsername = async () => {
    if (!userEmail || !usernameInput) return;
    setError("");
    setOkMsg("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
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
          : { username: usernameInput, email: userEmail, avatarUrl: null }
      );

      // 同步更新到 UserContext，触发全局状态更新
      userContext.updateProfile({ username: usernameInput });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : messages.profile.errorUsernameUpdateFailed
      );
    }
  };

  const updateAvatar = async (overrideAvatarUrl?: string | null) => {
    if (!userEmail) return;
    setError("");
    setOkMsg("");
    try {
      const finalAvatarUrl =
        overrideAvatarUrl !== undefined
          ? overrideAvatarUrl
          : avatarUrlInput.trim() || null;
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          avatarUrl: finalAvatarUrl,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.profile.errorAvatarUpdateFailed);
      }
      const data = (await res.json().catch(() => null)) as
        | { avatarUrl?: string | null }
        | null;

      setOkMsg(messages.profile.successAvatarUpdated);
      const newAvatarUrl =
        typeof data?.avatarUrl === "string" ? data.avatarUrl : null;
      setProfile((p) =>
        p
          ? { ...p, avatarUrl: newAvatarUrl }
          : { username: usernameInput || "", email: userEmail, avatarUrl: newAvatarUrl }
      );

      // 同步更新到 UserContext，触发全局状态更新（包括 localStorage 和事件通知）
      userContext.updateProfile({ avatarUrl: newAvatarUrl });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : messages.profile.errorAvatarUpdateFailed
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
    if (!userEmail) return;
    if (!newEmail || !emailCode) {
      setError(messages.profile.errorUpdateEmailFieldsRequired);
      return;
    }

    setError("");
    setOkMsg("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          newEmail,
          emailCode,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || messages.profile.errorUpdateEmailFailed);
      }
      setOkMsg(messages.profile.successEmailUpdated);
      setNewEmail("");
      setEmailCode("");

      if (typeof window !== "undefined") {
        // 最佳努力清理服务端 Session Cookie
        try {
          await fetch("/api/logout", { method: "POST" });
        } catch {
          // ignore
        }
        // 修改邮箱后强制退出登录，要求使用新邮箱重新登录
        window.localStorage.removeItem("loggedInUserEmail");
        window.localStorage.removeItem("loggedInUserName");
        setTimeout(() => {
          window.location.href = "/login";
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

  // 等待 UserContext 初始化完成再判断登录状态
  if (!isUserInitialized) {
    return (
      <div className="vben-page">
        <p>{messages.common.loading}</p>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="vben-page">
        <p>{messages.common.loginRequired}</p>
        <Link href="/login">{messages.common.goLogin}</Link>
      </div>
    );
  }

  return (
    <div className="vben-page">
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
                    {profile.avatarUrl ? messages.profile.changeAvatar : messages.profile.setAvatar}
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
                      void (async () => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        // 允许重复选择同一张图片也能触发 onChange
                        e.currentTarget.value = "";

                        // Android 相册/相机图片通常远大于 300KB；统一放宽到 2MB（并与后端限制保持一致）
                        if (file.size > 2 * 1024 * 1024) {
                          setError(messages.profile.errorAvatarTooLarge);
                          return;
                        }

                        if (!userEmail) return;

                        setError("");
                        setOkMsg("");
                        setAvatarUploading(true);

                        try {
                          const formData = new FormData();
                          formData.append("email", userEmail);
                          formData.append("file", file);

                          const res = await fetch("/api/avatar/upload", {
                            method: "POST",
                            body: formData,
                          });

                          if (!res.ok) {
                            const text = await res.text();
                            throw new Error(
                              text || messages.profile.errorAvatarUpdateFailed
                            );
                          }

                          const data = (await res.json()) as {
                            dbUrl: string;
                            publicUrl: string;
                          };

                          // dbUrl 用于写入数据库（r2://...）；publicUrl 用于展示
                          setAvatarUrlInput(data.dbUrl);
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : messages.profile.errorAvatarUpdateFailed
                          );
                        } finally {
                          setAvatarUploading(false);
                        }
                      })();
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
                    disabled={avatarUploading}
                  >
                    {avatarUploading ? messages.common.loading : messages.profile.avatarDialogSave}
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
                </div>
                <div className="dialog-card__actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmailDialog(false);
                      setNewEmail("");
                      setEmailCode("");
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
    </div>
  );
}




