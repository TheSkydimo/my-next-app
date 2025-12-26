"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Typography, Card, Button, Space, Row, Col, Alert, theme, Grid } from "antd";
import { CloudUploadOutlined, ShoppingCartOutlined, RightOutlined } from "@ant-design/icons";
import type { AppLanguage } from "../client-prefs";
import { getInitialLanguage } from "../client-prefs";
import { getUserMessages } from "../user-i18n";
import { useOptionalUser } from "../contexts/UserContext";
import { AuthEmailCodePage } from "../components/AuthEmailCodePage";
import UserOrdersReadOnlyPanel from "../components/UserOrdersReadOnlyPanel";
import { useUserOrdersPreview } from "../hooks/useUserOrdersPreview";

const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

export default function Home() {
  const { token } = theme.useToken();
  const userContext = useOptionalUser();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

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
            <Alert
              message={
                <Title level={5} style={{ margin: 0 }}>
                  {messages.home.orderUploadCtaTitle}
                </Title>
              }
              description={
                <div style={{ marginTop: 8 }}>
                  <Paragraph style={{ marginBottom: 16, color: token.colorTextSecondary }}>
                    {messages.home.orderUploadCtaDesc}
                  </Paragraph>
                  <Link href="/devices#order-section">
                    <Button type="primary" size="large" icon={<CloudUploadOutlined />}>
                      {messages.home.orderUploadCtaButton}
                    </Button>
                  </Link>
                </div>
              }
              type="info"
              showIcon={!isMobile} // Mobile might be too crowded with icon
              icon={<ShoppingCartOutlined style={{ fontSize: 24 }} />}
              style={{
                border: `1px solid ${token.colorPrimaryBorder}`,
                backgroundColor: token.colorPrimaryBg,
                padding: isMobile ? 16 : 24,
              }}
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
