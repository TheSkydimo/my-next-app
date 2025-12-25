"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AppLanguage } from "../client-prefs";
import { getInitialLanguage } from "../client-prefs";
import { getUserMessages } from "../user-i18n";
import { useOptionalUser } from "../contexts/UserContext";
import { AuthEmailCodePage } from "../components/AuthEmailCodePage";
import UserOrdersReadOnlyPanel from "../components/UserOrdersReadOnlyPanel";
import { useUserOrdersPreview } from "../hooks/useUserOrdersPreview";

export default function Home() {
  // 使用 UserContext 获取预加载的用户信息
  const userContext = useOptionalUser();
  const displayName = userContext?.profile?.username ?? userContext?.profile?.email ?? null;
  const userEmail = userContext?.profile?.email ?? null;

  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ language: AppLanguage }>;
      if (custom.detail?.language) {
        setLanguage(custom.detail.language);
      }
    };

    window.addEventListener("app-language-changed", handler as EventListener);
    return () => {
      window.removeEventListener(
        "app-language-changed",
        handler as EventListener
      );
    };
  }, []);

  const messages = getUserMessages(language);
  const ordersPreview = useUserOrdersPreview(userEmail, language);
  const hasOrderInfo = ordersPreview.items.length > 0;
  // 规则：有订单信息就隐藏引导语；无订单信息（或拉取失败）才显示引导语
  const shouldShowCta =
    !!userEmail &&
    !hasOrderInfo &&
    (ordersPreview.loaded || !!ordersPreview.error);

  // 与管理端保持一致：已登录用户的欢迎信息采用简单文本布局，不再使用块状卡片
  if (displayName) {
    return (
      <div className="vben-page">
        <div className="vben-page__header">
          <h1 className="vben-page__title">{messages.home.welcomeTitle(displayName)}</h1>
          {userEmail && (
            <p className="vben-page__subtitle">
              {messages.home.currentEmailPrefix}
              {userEmail}
            </p>
          )}
        </div>

        {shouldShowCta && (
          <section className="user-page-section" style={{ marginTop: 18 }}>
            <div className="user-page-card">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 220 }}>
                  <div
                    className="user-page-section__title"
                    style={{ margin: 0, fontSize: 16, fontWeight: 600 }}
                  >
                    {messages.home.orderUploadCtaTitle}
                  </div>
                  <div
                    className="user-page-section__subtext"
                    style={{ marginTop: 6, lineHeight: 1.6 }}
                  >
                    {messages.home.orderUploadCtaDesc}
                  </div>
                </div>

                <Link
                  href="/devices#order-section"
                  className="btn btn-primary btn-lg"
                >
                  {messages.home.orderUploadCtaButton}
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* 有“下一步”提示时，不展示下方“我的订单信息”区域，避免信息重复与干扰 */}
        {userEmail && !shouldShowCta && (
          <UserOrdersReadOnlyPanel
            language={language}
            items={ordersPreview.items}
            loading={ordersPreview.loading}
            error={ordersPreview.error}
          />
        )}
      </div>
    );
  }

  // 避免在 cookie 已有效但 UserContext 尚未完成初始化时渲染登录页（可能触发 AuthEmailCodePage 的重定向刷新）
  if (userContext && !userContext.initialized) {
    return (
      <div className="vben-page">
        <div className="vben-page__header">
          <h1 className="vben-page__title">{messages.common.loading}</h1>
        </div>
      </div>
    );
  }

  // 未登录：主页直接显示登录页（隐藏原访客首页）
  return <AuthEmailCodePage variant="user" />;
}

