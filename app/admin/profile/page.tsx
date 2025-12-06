"use client";

import { useEffect, useState } from "react";

type Profile = {
  username: string;
  email: string;
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

export default function AdminProfilePage() {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [usernameInput, setUsernameInput] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailOldPassword, setEmailOldPassword] = useState("");
  const [emailNewPassword, setEmailNewPassword] = useState("");
  const [emailConfirmNewPassword, setEmailConfirmNewPassword] = useState("");

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
        throw new Error(text || "获取个人信息失败");
      }
      const data = (await res.json()) as {
        username: string;
        email: string;
      };
      setProfile({ username: data.username, email: data.email });
      setUsernameInput(data.username);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取个人信息失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminEmail) {
      loadProfile(adminEmail);
    }
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
        throw new Error(text || "更新用户名失败");
      }
      setOkMsg("用户名已更新");
      setProfile((p) =>
        p ? { ...p, username: usernameInput } : { username: usernameInput, email: adminEmail }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新用户名失败");
    }
  };

  const updatePassword = async () => {
    if (!adminEmail) return;
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
          email: adminEmail,
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
    if (!adminEmail) return;
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
          email: adminEmail,
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
        // 修改邮箱后强制退出管理员登录，要求使用新邮箱重新登录
        window.localStorage.removeItem("adminEmail");
        window.localStorage.removeItem("isAdmin");
        setTimeout(() => {
          window.location.href = "/admin/login";
        }, 1200);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "修改邮箱失败");
    }
  };

  if (!adminEmail) {
    return (
      <div>
        <h1>个人信息管理</h1>
        <p>未检测到管理员登录，请先登录。</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
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
                gap: 8,
                marginTop: 8,
              }}
            >
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

          {showUsernameDialog && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
              }}
            >
              <div
                style={{
                  background: "#fff",
                  padding: 24,
                  borderRadius: 8,
                  maxWidth: 420,
                  width: "90%",
                  boxShadow:
                    "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
                }}
              >
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>修改用户名</h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <input
                    placeholder="新用户名"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                  />
                </div>
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowUsernameDialog(false);
                      setUsernameInput(profile.username);
                    }}
                    style={{
                      background: "#e5e7eb",
                      borderColor: "#d1d5db",
                      color: "#111827",
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateUsername();
                      setShowUsernameDialog(false);
                    }}
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
                修改管理员登录密码需要输入旧密码进行验证。
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
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
              }}
            >
              <div
                style={{
                  background: "#fff",
                  padding: 24,
                  borderRadius: 8,
                  maxWidth: 420,
                  width: "90%",
                  boxShadow:
                    "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
                }}
              >
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>修改密码</h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
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
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordDialog(false);
                      setOldPassword("");
                      setNewPassword("");
                      setConfirmNewPassword("");
                    }}
                    style={{
                      background: "#e5e7eb",
                      borderColor: "#d1d5db",
                      color: "#111827",
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updatePassword();
                      setShowPasswordDialog(false);
                    }}
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
                修改管理员登录邮箱前需要先验证新邮箱，并设置新密码。
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
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
              }}
            >
              <div
                style={{
                  background: "#fff",
                  padding: 24,
                  borderRadius: 8,
                  maxWidth: 420,
                  width: "90%",
                  boxShadow:
                    "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
                }}
              >
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>确认修改邮箱</h3>
                <p style={{ fontSize: 13, color: "#f97316", marginBottom: 12 }}>
                  修改邮箱时会同时更新登录密码，请先验证新邮箱并设置新密码。
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
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
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                  }}
                >
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
                    style={{
                      background: "#e5e7eb",
                      borderColor: "#d1d5db",
                      color: "#111827",
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateEmail();
                      setShowEmailDialog(false);
                    }}
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


