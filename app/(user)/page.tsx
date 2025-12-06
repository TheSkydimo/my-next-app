"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const nickname = window.localStorage.getItem("loggedInUserName");
      const email = window.localStorage.getItem("loggedInUserEmail");
      setDisplayName(nickname || email);
      setUserEmail(email);
    }
  }, []);

  const logout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("loggedInUserEmail");
      window.localStorage.removeItem("loggedInUserName");
      window.location.href = "/login";
    }
  };

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "80px auto",
        position: "relative",
        paddingTop: 40,
      }}
    >
      {displayName && (
        <button
          onClick={logout}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
          }}
        >
          退出登录
        </button>
      )}

      {displayName ? (
        <>
          <p>欢迎，{displayName}！</p>
          {userEmail && (
            <p style={{ fontSize: 14, color: "#6b7280" }}>
              当前登录邮箱：{userEmail}
            </p>
          )}
        </>
      ) : (
        <>
          <p>你还没有登录，请先登录或注册。</p>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/login">去登录</Link>
            <Link href="/register">去注册</Link>
          </div>
        </>
      )}
    </div>
  );
}


