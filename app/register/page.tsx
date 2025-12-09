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
  const [emailCode, setEmailCode] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 初始生成验证码
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
      setError("请先填写邮箱");
      return;
    }

    setSendingCode(true);
    try {
      const res = await fetch("/api/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "register" }),
      });

      if (!res.ok) {
        const text = await res.text();
        setError(text || "发送邮箱验证码失败");
        return;
      }

      setCodeMsg("验证码已发送到邮箱，请注意查收");
    } catch (error) {
      console.error(error);
      setError("发送邮箱验证码失败");
    } finally {
      setSendingCode(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk(false);

    if (!username || !email || !password || !confirmPassword || !emailCode) {
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

    const res = await fetch("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password, emailCode }),
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
    <div className="auth-page">
      <div className="auth-card">
        <h1>用户注册</h1>

        <form onSubmit={submit} className="auth-card__form">
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

          <div className="auth-card__field-row">
            <input
              placeholder="邮箱验证码"
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value)}
              className="auth-card__field-grow"
            />
            <button
              type="button"
              onClick={sendEmailCode}
              disabled={sendingCode}
              className="auth-card__secondary-button"
            >
              {sendingCode ? "发送中..." : "获取邮箱验证码"}
            </button>
          </div>

          <div className="auth-card__field-row">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-card__field-grow"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="auth-card__ghost-button"
            >
              {showPassword ? "隐藏" : "显示"}
            </button>
          </div>

          <div className="auth-card__field-row">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="确认密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="auth-card__field-grow"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="auth-card__ghost-button"
            >
              {showConfirmPassword ? "隐藏" : "显示"}
            </button>
          </div>

          <div className="auth-card__field-row">
            <input
              placeholder="验证码"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              className="auth-card__field-grow"
            />
            <div
              onClick={refreshCaptcha}
              className="auth-card__captcha"
              title="点击更换验证码"
            >
              {captcha}
            </div>
          </div>

          <button type="submit" className="auth-card__submit-button">
            注册
          </button>
        </form>

        {error && <p className="auth-card__error">{error}</p>}
        {codeMsg && <p className="auth-card__success">{codeMsg}</p>}
        {ok && (
          <p className="auth-card__success">注册成功，即将跳转到登录页…</p>
        )}
      </div>
    </div>
  );
}
