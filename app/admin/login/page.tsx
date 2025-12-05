"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      setError("管理员邮箱或密码错误");
      return;
    }

    const data = (await res.json()) as {
      ok: boolean;
      admin: { username: string; email: string };
    };

    if (typeof window !== "undefined") {
      window.localStorage.setItem("adminEmail", data.admin.email);
      window.localStorage.setItem("adminName", data.admin.username);
      window.localStorage.setItem("isAdmin", "true");
    }

    window.location.href = "/admin";
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto" }}>
      <h1>管理员登录</h1>

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

        <button>登录后台</button>
      </form>

      <div style={{ marginTop: 16 }}>
        <p>
          忘记管理员密码？{" "}
          <Link href="/admin/forgot-password">管理员找回密码</Link>
        </p>
        <p style={{ marginTop: 4 }}>
          返回用户登录：<Link href="/login">用户登录</Link>
        </p>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}


