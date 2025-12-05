"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      setError("邮箱或密码错误");
      return;
    }

    const data = (await res.json()) as {
      ok: boolean;
      user: { username: string; email: string };
    };

    // 简单登录状态：保存在 localStorage
    if (typeof window !== "undefined") {
      window.localStorage.setItem("loggedInUserEmail", data.user.email);
      window.localStorage.setItem("loggedInUserName", data.user.username);
    }

    // 登录成功后跳转首页
    window.location.href = "/";
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto" }}>
      <h1>用户登录</h1>

      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="密码"
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

        <button>登录</button>
      </form>

      <p style={{ marginTop: 16 }}>
        还没有账号？ <Link href="/register">去注册</Link>
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
