"use client";

import Link from "next/link";
export default function AdminForgotPasswordPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>管理员已改为邮箱验证码登录</h1>
        <p style={{ marginTop: 8 }}>
          目前不再提供“找回 / 重置管理员密码”。请直接返回登录页，通过邮箱验证码登录。
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/admin/login">返回管理员登录</Link>
        </p>
      </div>
    </div>
  );
}

