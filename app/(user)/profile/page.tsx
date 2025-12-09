"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Profile = {
  username: string;
  email: string;
  avatarUrl: string | null;
};

function PasswordField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
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
        {visible ? "隐藏" : "显示"}
      </button>
    </div>
  );
}

export default function UserProfilePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [usernameInput, setUsernameInput] = useState("");

  const [avatarUrlInput, setAvatarUrlInput] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailOldPassword, setEmailOldPassword] = useState("");
  const [emailNewPassword, setEmailNewPassword] = useState("");
  const [emailConfirmNewPassword, setEmailConfirmNewPassword] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const email = window.localStorage.getItem("loggedInUserEmail");
      if (email) {
        setUserEmail(email);
      }
    }
  }, []);

  const loadProfile = async (email: string) => {
    setLoading(true);
    setError("");
    setOkMsg("");
    try {
      const res = await fetch(
        `/api/user/profile?email=${encodeURIComponent(email)}`
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "获取个人信息失败");
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
      setError(e instanceof Error ? e.message : "获取个人信息失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userEmail) {
      loadProfile(userEmail);
    }
  }, [userEmail]);

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
        throw new Error(text || "更新用户名失败");
      }
      setOkMsg("用户名已更新");
      setProfile((p) =>
        p
          ? { ...p, username: usernameInput }
          : { username: usernameInput, email: userEmail, avatarUrl: null }
      );

      if (typeof window !== "undefined") {
        window.localStorage.setItem("loggedInUserName", usernameInput);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新用户名失败");
    }
  };

  const updateAvatar = async () => {
    if (!userEmail) return;
    setError("");
    setOkMsg("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          avatarUrl: avatarUrlInput.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "更新头像失败");
      }
      setOkMsg("头像已更新");
      setProfile((p) =>
        p
          ? { ...p, avatarUrl: avatarUrlInput.trim() || null }
          : { username: usernameInput || "", email: userEmail, avatarUrl: avatarUrlInput.trim() || null }
      );

      if (typeof window !== "undefined") {
        if (avatarUrlInput.trim()) {
          window.localStorage.setItem("loggedInUserAvatar", avatarUrlInput.trim());
        } else {
          window.localStorage.removeItem("loggedInUserAvatar");
        }

        // 通知布局更新右上角头像
        window.dispatchEvent(
          new CustomEvent("user-avatar-updated", {
            detail: {
              avatarUrl: avatarUrlInput.trim() || null,
              displayName: profile?.username ?? usernameInput ?? null,
            },
          })
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新头像失败");
    }
  };

  const updatePassword = async () => {
    if (!userEmail) return;
    setError("");
    setOkMsg("");

    if (!oldPassword || !newPassword || !confirmNewPassword) {
      setError("请完整填写旧密码和新密码");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          oldPassword,
          newPassword,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "修改密码失败");
      }
      setOkMsg("密码已修改");
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "修改密码失败");
    }
  };

  const sendChangeEmailCode = async () => {
    if (!newEmail) {
      setError("请先填写新邮箱");
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
        throw new Error(text || "发送验证码失败");
      }
      setOkMsg("验证码已发送到新邮箱，请注意查收");
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送验证码失败");
    } finally {
      setSendingCode(false);
    }
  };

  const updateEmail = async () => {
    if (!userEmail) return;
    if (!newEmail || !emailCode) {
      setError("请填写新邮箱和邮箱验证码");
      return;
    }

    if (!emailOldPassword || !emailNewPassword || !emailConfirmNewPassword) {
      setError("请在弹出的对话框中填写旧密码和新密码");
      return;
    }

    if (emailNewPassword !== emailConfirmNewPassword) {
      setError("两次输入的新密码不一致");
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
          oldPassword: emailOldPassword,
          newPassword: emailNewPassword,
          newEmail,
          emailCode,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "修改邮箱失败");
      }
      setOkMsg("邮箱已修改，请使用新邮箱登录");
      setEmailOldPassword("");
      setEmailNewPassword("");
      setEmailConfirmNewPassword("");
      setNewEmail("");
      setEmailCode("");

      if (typeof window !== "undefined") {
        // 修改邮箱后强制退出登录，要求使用新邮箱重新登录
        window.localStorage.removeItem("loggedInUserEmail");
        window.localStorage.removeItem("loggedInUserName");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1200);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "修改邮箱失败");
    }
  };

  if (!userEmail) {
    return (
      <div style={{ maxWidth: 640, margin: "80px auto" }}>
        <h1>个人信息管理</h1>
        <p>未检测到用户登录，请先登录。</p>
        <Link href="/login">去登录</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "80px auto" }}>
      <h1>个人信息管理</h1>

      {loading && <p>加载中...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {okMsg && <p style={{ color: "green" }}>{okMsg}</p>}

      {profile && (
        <>
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 16 }}>基础信息</h2>
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
                      alt="用户头像"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span>无头像</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setOkMsg("");
                    setAvatarUrlInput(profile.avatarUrl ?? "");
                    setShowAvatarDialog(true);
                  }}
                >
                  {profile.avatarUrl ? "修改头像" : "设置头像"}
                </button>
              </div>
              <label style={{ fontSize: 14 }}>
                当前邮箱：<strong>{profile.email}</strong>
              </label>
              <label style={{ fontSize: 14 }}>
                用户名：<strong>{profile.username}</strong>
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setOkMsg("");
                    setUsernameInput(profile.username);
                    setShowUsernameDialog(true);
                  }}
                >
                  修改用户名
                </button>
              </div>
            </div>
          </section>

          {showAvatarDialog && (
            <div className="dialog-overlay">
              <div className="dialog-card">
                <h3 className="dialog-card__title">设置头像</h3>
                <p className="dialog-card__desc dialog-card__desc--muted">
                  你可以直接上传本地图片，或手动输入图片 URL。留空后保存则清除头像。
                </p>
                <div className="dialog-card__body">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      if (file.size > 300 * 1024) {
                        setError("头像图片大小请控制在 300KB 以内");
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
                    placeholder="或输入图片 URL，例如：https://example.com/avatar.png"
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
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateAvatar();
                      setShowAvatarDialog(false);
                    }}
                    className="dialog-card__primary"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}

          {showUsernameDialog && (
            <div className="dialog-overlay">
              <div className="dialog-card">
                <h3 className="dialog-card__title">修改用户名</h3>
                <div className="dialog-card__body">
                  <input
                    placeholder="新用户名"
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
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateUsername();
                      setShowUsernameDialog(false);
                    }}
                    className="dialog-card__primary"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}

          <section style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 16 }}>修改密码</h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 8,
              }}
            >
              <p style={{ fontSize: 14 }}>
                修改登录密码需要输入旧密码进行验证。
              </p>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setOkMsg("");
                  setShowPasswordDialog(true);
                }}
              >
                修改密码
              </button>
            </div>
          </section>

          {showPasswordDialog && (
            <div className="dialog-overlay">
              <div className="dialog-card">
                <h3 className="dialog-card__title">修改密码</h3>
                <div className="dialog-card__body">
                  <PasswordField
                    placeholder="旧密码"
                    value={oldPassword}
                    onChange={setOldPassword}
                  />
                  <PasswordField
                    placeholder="新密码"
                    value={newPassword}
                    onChange={setNewPassword}
                  />
                  <PasswordField
                    placeholder="确认新密码"
                    value={confirmNewPassword}
                    onChange={setConfirmNewPassword}
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
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updatePassword();
                      setShowPasswordDialog(false);
                    }}
                    className="dialog-card__primary"
                  >
                    确认修改
                  </button>
                </div>
              </div>
            </div>
          )}

          <section style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 16 }}>修改邮箱</h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 8,
              }}
            >
              <p style={{ fontSize: 14 }}>
                修改登录邮箱前需要先验证新邮箱，并设置新密码。
              </p>
              <button
                onClick={() => {
                  setError("");
                  setOkMsg("");
                  setShowEmailDialog(true);
                }}
              >
                修改邮箱
              </button>
            </div>
          </section>

          {showEmailDialog && (
            <div className="dialog-overlay">
              <div className="dialog-card">
                <h3 className="dialog-card__title">确认修改邮箱</h3>
                <p className="dialog-card__desc dialog-card__desc--warn">
                  修改邮箱时会同时更新登录密码，请先验证新邮箱并设置新密码。
                </p>
                <div className="dialog-card__body">
                  <input
                    type="email"
                    placeholder="新邮箱"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      placeholder="邮箱验证码"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={sendChangeEmailCode}
                      disabled={sendingCode}
                    >
                      {sendingCode ? "发送中..." : "获取验证码"}
                    </button>
                  </div>
                  <PasswordField
                    placeholder="旧密码"
                    value={emailOldPassword}
                    onChange={setEmailOldPassword}
                  />
                  <PasswordField
                    placeholder="新密码"
                    value={emailNewPassword}
                    onChange={setEmailNewPassword}
                  />
                  <PasswordField
                    placeholder="确认新密码"
                    value={emailConfirmNewPassword}
                    onChange={setEmailConfirmNewPassword}
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
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateEmail();
                      setShowEmailDialog(false);
                    }}
                    className="dialog-card__primary"
                  >
                    确认修改
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




