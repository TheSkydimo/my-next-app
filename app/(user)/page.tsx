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

  return (
    <div className="home-page">
      {displayName ? (
        <div className="home-card home-card--welcome">
          <h1>欢迎，{displayName}！</h1>
          {userEmail && (
            <p className="home-card__subtext">当前登录邮箱：{userEmail}</p>
          )}
        </div>
      ) : (
        <div className="home-card home-card--guest">
          <h1>欢迎来到Skydimo用户管理系统</h1>
          <p className="home-card__subtext">
            你还没有登录，请先登录或注册。
          </p>
          <div className="home-card__actions">
            <Link href="/login" className="home-card__primary-link">
              去登录
            </Link>
            <Link href="/register" className="home-card__secondary-link">
              去注册
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}


