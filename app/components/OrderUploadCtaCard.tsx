"use client";

import Link from "next/link";
import React from "react";
import { Button, Card, Grid, Space, Tag, Typography, theme } from "antd";
import { CloudUploadOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

function splitTitle(rawTitle: string): { tag?: string; headline: string } {
  const title = rawTitle.trim();
  if (!title) return { headline: "" };

  // Support both Chinese and English punctuation: "下一步：" / "Next step:"
  const match = title.match(/^(.+?)([:：])\s*(.+)$/);
  if (!match) return { headline: title };

  const tag = match[1]?.trim();
  const headline = match[3]?.trim();

  if (!tag || !headline) return { headline: title };
  return { tag, headline };
}

export default function OrderUploadCtaCard({
  title,
  description,
  buttonText,
  href,
}: {
  title: string;
  description: string;
  buttonText: string;
  href: string;
}) {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { tag, headline } = splitTitle(title);

  return (
    <Card
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderLeft: `4px solid ${token.colorPrimary}`,
        borderRadius: token.borderRadiusLG,
      }}
      styles={{
        body: {
          padding: isMobile ? 16 : 20,
        },
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "flex-start",
          justifyContent: "space-between",
          gap: isMobile ? 12 : 24,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Space direction="vertical" size={6} style={{ width: "100%" }}>
            <Space size={10} wrap>
              {tag ? (
                <Tag color="processing" style={{ marginInlineEnd: 0 }}>
                  {tag}
                </Tag>
              ) : null}
              <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
                {headline || title}
              </Title>
            </Space>
            <Text type="secondary" style={{ fontSize: 14 }}>
              {description}
            </Text>
          </Space>
        </div>

        <Link href={href} style={{ alignSelf: isMobile ? "stretch" : "flex-start" }}>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            size={isMobile ? "middle" : "large"}
            block={isMobile}
          >
            {buttonText}
          </Button>
        </Link>
      </div>
    </Card>
  );
}


