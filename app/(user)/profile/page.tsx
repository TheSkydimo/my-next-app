"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Profile = {
  username: string;
  email: string;
};

export default function UserProfilePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
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
          : { username: usernameInput, email: userEmail }
      );

      if (typeof window !== "undefined") {
        window.localStorage.setItem("loggedInUserName", usernameInput);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新用户名失败");
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
        throw new Error(text || "修改邮箱失败");
      }
      setOkMsg("邮箱已修改，请使用新邮箱登录");
      setProfile((p) =>
        p
          ? { ...p, email: newEmail }
          : { username: usernameInput || "", email: newEmail }
      );
      setNewEmail("");
      setEmailCode("");

      if (typeof window !== "undefined") {
        window.localStorage.setItem("loggedInUserEmail", newEmail);
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
                gap: 8,
                marginTop: 8,
              }}
            >
              <label style={{ fontSize: 14 }}>
                当前邮箱：<strong>{profile.email}</strong>
              </label>
              <label style={{ fontSize: 14 }}>用户名：</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button onClick={updateUsername}>保存</button>
              </div>
            </div>
          </section>

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
              <input
                type="password"
                placeholder="旧密码"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
              <input
                type="password"
                placeholder="新密码"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                type="password"
                placeholder="确认新密码"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
              <button onClick={updatePassword}>修改密码</button>
            </div>
          </section>

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
                <button onClick={sendChangeEmailCode} disabled={sendingCode}>
                  {sendingCode ? "发送中..." : "获取验证码"}
                </button>
              </div>
              <button onClick={updateEmail}>修改邮箱</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}


