"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function generateCaptcha(length = 5): string {
  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    result += chars[idx];
  }
  return result;
}

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    setCaptcha(generateCaptcha());
  }, []);

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaInput("");
  };

  const sendEmailCode = async () => {
    setError("");
    setCodeMsg("");

    if (!email) {
      setError("请先填写管理员邮箱");
      return;
    }

    setSendingCode(true);
    try {
      const res = await fetch("/api/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "admin-forgot" }),
      });

      if (!res.ok) {
        const text = await res.text();
        setError(text || "发送邮箱验证码失败");
        return;
      }

      setCodeMsg("验证码已发送到管理员邮箱，请注意查收");
    } catch {
      setError("发送邮箱验证码失败");
    } finally {
      setSendingCode(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk(false);

    if (!email || !password || !confirmPassword || !emailCode) {
      setError("请完整填写所有字段（包括邮箱验证码）");
      return;
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    if (!captchaInput) {
      setError("请输入图形验证码");
      return;
    }

    if (captchaInput.trim().toLowerCase() !== captcha.toLowerCase()) {
      setError("图形验证码错误");
      refreshCaptcha();
      return;
    }

    const res = await fetch("/api/admin/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, emailCode }),
    });

    if (!res.ok) {
      const text = await res.text();
      setError(text || "重置管理员密码失败");
      refreshCaptcha();
      return;
    }

    setOk(true);
    setTimeout(() => {
      window.location.href = "/admin/login";
    }, 1500);
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto" }}>
      <h1>管理员忘记密码</h1>

      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <input
          type="email"
          placeholder="管理员邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            placeholder="邮箱验证码"
            value={emailCode}
            onChange={(e) => setEmailCode(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={sendEmailCode}
            disabled={sendingCode}
            style={{
              minWidth: 110,
              background: "#10b981",
              borderColor: "#10b981",
            }}
          >
            {sendingCode ? "发送中..." : "获取邮箱验证码"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="新密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            style={{
              minWidth: 80,
              background: "#e5e7eb",
              color: "#111827",
              borderColor: "#d1d5db",
            }}
          >
            {showPassword ? "隐藏" : "显示"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="确认新密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            style={{
              minWidth: 80,
              background: "#e5e7eb",
              color: "#111827",
              borderColor: "#d1d5db",
            }}
          >
            {showConfirmPassword ? "隐藏" : "显示"}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            placeholder="验证码"
            value={captchaInput}
            onChange={(e) => setCaptchaInput(e.target.value)}
            style={{ flex: 1 }}
          />
          <div
            onClick={refreshCaptcha}
            style={{
              cursor: "pointer",
              padding: "6px 10px",
              borderRadius: 4,
              border: "1px solid #ccc",
              userSelect: "none",
              fontWeight: "bold",
              letterSpacing: 2,
            }}
            title="点击更换验证码"
          >
            {captcha}
          </div>
        </div>

        <button type="submit">重置管理员密码</button>
      </form>

      <p style={{ marginTop: 16 }}>
        返回管理员登录：<Link href="/admin/login">管理员登录</Link>
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {codeMsg && <p style={{ color: "green" }}>{codeMsg}</p>}
      {ok && (
        <p style={{ color: "green" }}>密码重置成功，即将跳转到管理员登录页…</p>
      )}
    </div>
  );
}

