"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const nickname = window.localStorage.getItem("loggedInUserName");
      const email = window.localStorage.getItem("loggedInUserEmail");
      setDisplayName(nickname || email);
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
      <h1>首页</h1>

      {displayName ? (
        <>
          <p>欢迎，{displayName}！</p>
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
