"use client";

import { useEffect, useState } from "react";

// 简单验证码生成（0-9, a-z, A-Z）
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

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  // 初始生成验证码
  useEffect(() => {
    setCaptcha(generateCaptcha());
  }, []);

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaInput("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk(false);

    if (!username || !email || !password || !confirmPassword) {
      setError("请完整填写所有字段");
      return;
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    if (!captchaInput) {
      setError("请输入验证码");
      return;
    }

    if (captchaInput.trim().toLowerCase() !== captcha.toLowerCase()) {
      setError("验证码错误");
      refreshCaptcha();
      return;
    }

    const res = await fetch("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const text = await res.text();
      setError(text || "注册失败");
      refreshCaptcha();
      return;
    }

    setOk(true);
    // 注册成功，1.5 秒后跳到登录页
    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto" }}>
      <h1>用户注册</h1>

      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <input
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="确认密码"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

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

        <button type="submit">注册</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {ok && <p style={{ color: "green" }}>注册成功，即将跳转到登录页…</p>}
    </div>
  );
}
