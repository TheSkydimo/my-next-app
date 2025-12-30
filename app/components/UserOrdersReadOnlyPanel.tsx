"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, Button, Typography, Space, Alert, Grid } from "antd";
import { CloudUploadOutlined, UnorderedListOutlined } from "@ant-design/icons";
import type { AppLanguage } from "../client-prefs";
import { getUserMessages } from "../user-i18n";
import type { OrderSnapshot } from "../hooks/useUserOrdersPreview";
import UserOrdersList from "./UserOrdersList";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function UserOrdersReadOnlyPanel({
  language,
  items,
  loading,
  error,
  limit = 5,
}: {
  language: AppLanguage;
  items: OrderSnapshot[];
  loading: boolean;
  error: string;
  limit?: number;
}) {
  const messages = useMemo(() => getUserMessages(language), [language]);
  const topItems = items.slice(0, Math.max(1, limit));
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  return (
    <Card
      title={
        <Space direction="vertical" size={0}>
          <Title level={4} style={{ margin: 0 }}>
            {messages.home.orderPreviewTitle}
          </Title>
          <Text type="secondary" style={{ fontSize: 14, fontWeight: "normal" }}>
            {messages.home.orderPreviewSubtitle(items.length)}
          </Text>
        </Space>
      }
      extra={
        <Space wrap>
          <Link href="/orders#order-section">
            <Button icon={<CloudUploadOutlined />} size={isMobile ? "small" : "middle"}>
              {!isMobile && messages.home.orderPreviewGoUpload}
            </Button>
          </Link>
          <Link href="/orders#order-section">
            <Button type="primary" icon={<UnorderedListOutlined />} size={isMobile ? "small" : "middle"}>
              {!isMobile && messages.home.orderPreviewViewAll}
            </Button>
          </Link>
        </Space>
      }
      style={{ marginTop: 16 }}
      styles={{ body: { padding: isMobile ? '0 12px 12px' : 0 } }}
    >
      {error ? (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          style={{ margin: 24 }}
        />
      ) : (
        <UserOrdersList 
            language={language}
            items={topItems}
            loading={loading}
            // Read-only mode implied by missing onDelete
        />
      )}
    </Card>
  );
}
