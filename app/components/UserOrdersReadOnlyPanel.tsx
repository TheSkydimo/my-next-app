"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Table, Card, Button, Typography, Image, Alert, List, Grid, Tag, Space, Empty } from "antd";
import type { TableProps } from "antd";
import { EyeOutlined, CloudUploadOutlined, UnorderedListOutlined, ShopOutlined, CalendarOutlined, NumberOutlined, ContainerOutlined } from "@ant-design/icons";
import type { AppLanguage } from "../client-prefs";
import { getUserMessages } from "../user-i18n";
import type { OrderSnapshot } from "../hooks/useUserOrdersPreview";

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

  const columns: TableProps<OrderSnapshot>["columns"] = [
    {
      title: language === "zh-CN" ? "截图" : "Screenshot",
      dataIndex: "imageUrl",
      key: "imageUrl",
      width: 100,
      render: (url) => (
        <Image
          src={url}
          alt="order"
          width={80}
          height={56}
          style={{ objectFit: "cover", borderRadius: 4 }}
          preview={{
            mask: <EyeOutlined />,
          }}
        />
      ),
    },
    {
      title: language === "zh-CN" ? "店铺" : "Shop",
      key: "shop",
      render: (_, record) => record.shopName ?? record.platform ?? "-",
    },
    {
      title: language === "zh-CN" ? "订单号" : "Order No",
      dataIndex: "orderNo",
      key: "orderNo",
      ellipsis: true,
      render: (text, record) => (
        <Text copyable={{ text: text ?? String(record.id) }}>
          {text ?? `${messages.home.orderPreviewOrderNoFallback}${record.id}`}
        </Text>
      ),
    },
    {
      title: language === "zh-CN" ? "创建时间" : "Created At",
      dataIndex: "orderCreatedTime",
      key: "orderCreatedTime",
      render: (text, record) => text ?? new Date(record.createdAt).toLocaleString(),
    },
    {
      title: language === "zh-CN" ? "付款时间" : "Paid At",
      dataIndex: "orderPaidTime",
      key: "orderPaidTime",
      render: (text) => text ?? "-",
    },
    {
      title: language === "zh-CN" ? "数量" : "Qty",
      dataIndex: "deviceCount",
      key: "deviceCount",
      align: "center",
      render: (count) => (count ? <Tag>{count}</Tag> : "-"),
    },
    {
      title: language === "zh-CN" ? "备注" : "Note",
      dataIndex: "note",
      key: "note",
      ellipsis: true,
      render: (text) => text ?? "-",
    },
  ];

  const renderMobileList = () => (
    <List
      dataSource={topItems}
      loading={loading}
      locale={{ 
        emptyText: (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description={messages.home.orderPreviewEmpty} 
          />
        ) 
      }}
      renderItem={(item) => (
        <List.Item>
          <Card 
            size="small" 
            style={{ width: '100%' }}
            styles={{ body: { padding: '12px' } }}
          >
             <Space align="start" style={{ width: '100%' }}>
                <Image
                  src={item.imageUrl}
                  alt="order"
                  width={80}
                  height={80}
                  style={{ objectFit: "cover", borderRadius: 4 }}
                />
                <Space direction="vertical" size={4} style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text strong ellipsis>{item.shopName ?? item.platform ?? "-"}</Text>
                    {item.deviceCount && <Tag style={{ margin: 0 }}>x{item.deviceCount}</Tag>}
                  </div>
                  
                  <Space size={4} style={{ color: 'rgba(0, 0, 0, 0.45)', fontSize: 12 }}>
                    <NumberOutlined />
                    <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                       {item.orderNo ?? `${messages.home.orderPreviewOrderNoFallback}${item.id}`}
                    </Text>
                  </Space>

                  <Space size={4} style={{ color: 'rgba(0, 0, 0, 0.45)', fontSize: 12 }}>
                    <CalendarOutlined />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                       {item.orderCreatedTime ?? new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </Space>
                  
                  {item.note && (
                    <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                       {item.note}
                    </Text>
                  )}
                </Space>
             </Space>
          </Card>
        </List.Item>
      )}
    />
  );

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
          <Link href="/devices#order-section">
            <Button icon={<CloudUploadOutlined />} size={isMobile ? "small" : "middle"}>
              {!isMobile && messages.home.orderPreviewGoUpload}
            </Button>
          </Link>
          <Link href="/devices#order-section">
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
        isMobile ? renderMobileList() : (
          <Table
            dataSource={topItems}
            columns={columns}
            rowKey="id"
            pagination={false}
            loading={loading}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={messages.home.orderPreviewEmpty}
                />
              ),
            }}
            scroll={{ x: 800 }}
          />
        )
      )}
    </Card>
  );
}
