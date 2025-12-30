"use client";

import { useEffect, useState } from "react";
import { Typography, Space, Grid } from "antd";
import type { AppLanguage } from "../../client-prefs";
import { getInitialLanguage } from "../../client-prefs";
import { getUserMessages } from "../../user-i18n";
import { useOptionalUser } from "../../contexts/UserContext";
import { AuthEmailCodePage } from "../../components/AuthEmailCodePage";
import UserOrdersReadOnlyPanel from "../../components/UserOrdersReadOnlyPanel";
import OrderUploadCtaCard from "../../components/OrderUploadCtaCard";
import { useUserOrdersPreview } from "../../hooks/useUserOrdersPreview";
import { getPreferredDisplayName } from "../../_utils/userDisplay";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function UserHomePage() {
  const userContext = useOptionalUser();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const displayName = getPreferredDisplayName(userContext?.profile ?? null);
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

  // 与管理端保持一致：已登录用户的欢迎信息采用简单文本布局
  if (displayName) {
    return (
      <div className="vben-page">
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* Welcome Header */}
          <div style={{ marginBottom: 16 }}>
            <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>
              {messages.home.welcomeTitle(displayName)}
            </Title>
            {userEmail && (
              <Text type="secondary" style={{ fontSize: isMobile ? 14 : 16 }}>
                {messages.home.currentEmailPrefix} {userEmail}
              </Text>
            )}
          </div>

          {/* CTA Section */}
          {shouldShowCta && (
            <OrderUploadCtaCard
              title={messages.home.orderUploadCtaTitle}
              description={messages.home.orderUploadCtaDesc}
              buttonText={messages.home.orderUploadCtaButton}
              href="/orders#order-section"
            />
          )}

          {/* Orders Panel */}
          {/* 有“下一步”提示时，不展示下方“我的订单信息”区域，避免信息重复与干扰 */}
          {userEmail && !shouldShowCta && (
            <UserOrdersReadOnlyPanel
              language={language}
              items={ordersPreview.items}
              loading={ordersPreview.loading}
              error={ordersPreview.error}
            />
          )}
        </Space>
      </div>
    );
  }

  // 避免在 cookie 已有效但 UserContext 尚未完成初始化时渲染登录页
  if (userContext && !userContext.initialized) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Title level={4}>{messages.common.loading}</Title>
      </div>
    );
  }

  // 未登录：主页直接显示登录页
  return <AuthEmailCodePage variant="user" />;
}


