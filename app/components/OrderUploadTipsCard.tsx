"use client";

import React from "react";
import { Card, List, Space, Typography, theme } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import type { AppLanguage } from "../client-prefs";

const { Text } = Typography;

export default function OrderUploadTipsCard({
  language,
  maxBytes,
}: {
  language: AppLanguage;
  maxBytes: number;
}) {
  const { token } = theme.useToken();
  const maxMb = Math.floor(maxBytes / (1024 * 1024));

  const title =
    language === "zh-CN"
      ? "上传前请确认截图包含“订单号/订单编号”，否则会识别失败"
      : "Before uploading, make sure the screenshot includes an Order Number/Order ID, otherwise recognition will fail";

  const lead =
    language === "zh-CN"
      ? "建议上传电商订单详情页/发票截图，需清晰可读："
      : "Recommended: upload an e-commerce order details or invoice screenshot. The following should be clearly readable:";

  const bullets =
    language === "zh-CN"
      ? [
          { text: "订单号/订单编号", strong: true },
          { text: "平台/店铺信息" },
          { text: "下单时间、付款时间" },
          { text: "购买数量" },
        ]
      : [
          { text: "Order number / Order ID", strong: true },
          { text: "Platform / shop information" },
          { text: "Order created time & paid time" },
          { text: "Purchased quantity" },
        ];

  const footer =
    language === "zh-CN"
      ? `仅支持图片，且大小不超过 ${maxMb}MB；同一订单号只能提交一次。`
      : `Images only, up to ${maxMb}MB; the same order number can only be submitted once.`;

  return (
    <Card
      size="small"
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        // In dark mode, primary blue can feel too "loud" for a hint block.
        // Use a neutral strip that matches the system's dark gray accents.
        borderLeft: `4px solid ${token.colorTextSecondary}`,
        borderRadius: token.borderRadiusLG,
      }}
      styles={{ body: { padding: 14 } }}
    >
      <Space direction="vertical" size={10} style={{ width: "100%" }}>
        <Space align="start" size={10}>
          <InfoCircleOutlined style={{ color: token.colorTextSecondary, marginTop: 2 }} />
          <Text strong>{title}</Text>
        </Space>

        <Text type="secondary">{lead}</Text>

        <List
          size="small"
          split={false}
          dataSource={bullets}
          renderItem={(item) => (
            <List.Item style={{ padding: "2px 0" }}>
              <Text strong={!!item.strong}>{item.text}</Text>
            </List.Item>
          )}
        />

        <Text type="secondary" style={{ fontSize: 12 }}>
          {footer}
        </Text>
      </Space>
    </Card>
  );
}


