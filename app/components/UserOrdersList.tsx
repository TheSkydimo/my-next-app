"use client";

import React, { useMemo } from "react";
import { Table, List, Button, Typography, Image, Tag, Space, Card, Grid, Popconfirm, Empty, Tooltip } from "antd";
import type { TableProps } from "antd";
import {
  EyeOutlined,
  DeleteOutlined,
  NumberOutlined,
  CalendarOutlined,
  FileTextOutlined
} from "@ant-design/icons";
import type { AppLanguage } from "../client-prefs";
import { getUserMessages } from "../user-i18n";

const { Text } = Typography;
const { useBreakpoint } = Grid;

export interface OrderSnapshot {
  id: number;
  deviceId: string;
  imageUrl: string;
  note: string | null;
  createdAt: string;
  orderNo?: string | null;
  orderCreatedTime?: string | null;
  orderPaidTime?: string | null;
  platform?: string | null;
  shopName?: string | null;
  deviceCount?: number | null;
}

interface UserOrdersListProps {
  language: AppLanguage;
  items: OrderSnapshot[];
  loading?: boolean;
  onDelete?: (order: OrderSnapshot) => void;
}

export default function UserOrdersList({
  language,
  items,
  loading = false,
  onDelete,
}: UserOrdersListProps) {
  const messages = useMemo(() => getUserMessages(language), [language]);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const handleDelete = (order: OrderSnapshot) => {
    onDelete?.(order);
  };

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
             // If parent provides custom preview handler, we might want to use it, 
             // but Antd Image has built-in preview which is nice.
             // If onPreview is passed, maybe use it? But Antd Image is easier.
          }}
        />
      ),
    },
    {
      title: language === "zh-CN" ? "店铺/平台" : "Shop/Platform",
      key: "shop",
      width: 150,
      render: (_, record) => (
        <Space>
           {record.platform && <Tag color="blue">{record.platform}</Tag>}
           <Text>{record.shopName ?? "-"}</Text>
        </Space>
      ),
    },
    {
      title: language === "zh-CN" ? "订单号" : "Order No",
      dataIndex: "orderNo",
      key: "orderNo",
      width: 180,
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
      width: 160,
      render: (text, record) => text ?? new Date(record.createdAt).toLocaleString(),
    },
    {
      title: language === "zh-CN" ? "付款时间" : "Paid At",
      dataIndex: "orderPaidTime",
      key: "orderPaidTime",
      width: 160,
      render: (text) => text ?? "-",
    },
    {
      title: language === "zh-CN" ? "数量" : "Qty",
      dataIndex: "deviceCount",
      key: "deviceCount",
      width: 80,
      align: "center",
      render: (count) => (count ? <Tag color="geekblue">{count}</Tag> : "-"),
    },
    {
      title: language === "zh-CN" ? "备注" : "Note",
      dataIndex: "note",
      key: "note",
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          {text ?? "-"}
        </Tooltip>
      ),
    },
    {
      title: language === "zh-CN" ? "操作" : "Action",
      key: "action",
      width: 100,
      fixed: "right",
      render: (_, record) => (
        onDelete && (
          <Popconfirm
            title={language === "zh-CN" ? "确定删除此订单截图吗?" : "Delete this order screenshot?"}
            description={language === "zh-CN" ? "此操作不可恢复。" : "This action cannot be undone."}
            onConfirm={() => handleDelete(record)}
            okText={language === "zh-CN" ? "删除" : "Delete"}
            cancelText={language === "zh-CN" ? "取消" : "Cancel"}
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              {language === "zh-CN" ? "删除" : "Delete"}
            </Button>
          </Popconfirm>
        )
      ),
    },
  ];

  const renderMobileList = () => (
    <List
      dataSource={items}
      loading={loading}
      locale={{
        emptyText: (
            <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={language === "zh-CN" ? "暂无订单数据" : "No order data"}
            />
        )
      }}
      renderItem={(item) => (
        <List.Item>
          <Card
            size="small"
            style={{ width: "100%" }}
            styles={{ body: { padding: "12px" } }}
            actions={[
                onDelete && (
                    <Popconfirm
                        key="delete"
                        title={language === "zh-CN" ? "确定删除?" : "Delete?"}
                        onConfirm={() => handleDelete(item)}
                        okText={language === "zh-CN" ? "是" : "Yes"}
                        cancelText={language === "zh-CN" ? "否" : "No"}
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} size="small">
                            {language === "zh-CN" ? "删除" : "Delete"}
                        </Button>
                    </Popconfirm>
                )
            ].filter(Boolean)}
          >
            <Space align="start" style={{ width: "100%" }}>
              <Image
                src={item.imageUrl}
                alt="order"
                width={80}
                height={80}
                style={{ objectFit: "cover", borderRadius: 4 }}
              />
              <Space direction="vertical" size={4} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text strong ellipsis>
                    {item.shopName ?? item.platform ?? "-"}
                  </Text>
                  {item.deviceCount && <Tag color="geekblue" style={{ margin: 0 }}>x{item.deviceCount}</Tag>}
                </div>

                <Space size={4} style={{ color: "rgba(0, 0, 0, 0.45)", fontSize: 12 }}>
                  <NumberOutlined />
                  <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                    {item.orderNo ?? `${messages.home.orderPreviewOrderNoFallback}${item.id}`}
                  </Text>
                </Space>

                <Space size={4} style={{ color: "rgba(0, 0, 0, 0.45)", fontSize: 12 }}>
                  <CalendarOutlined />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.orderCreatedTime ?? new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </Space>

                {item.note && (
                  <Space size={4} align="start" style={{ color: "rgba(0, 0, 0, 0.45)", fontSize: 12 }}>
                     <FileTextOutlined />
                     <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                        {item.note}
                     </Text>
                  </Space>
                )}
              </Space>
            </Space>
          </Card>
        </List.Item>
      )}
    />
  );

  return isMobile ? (
    renderMobileList()
  ) : (
    <Table
      dataSource={items}
      columns={columns}
      rowKey="id"
      loading={loading}
      pagination={{ pageSize: 5 }}
      scroll={{ x: 1000 }}
      locale={{
        emptyText: (
            <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={language === "zh-CN" ? "暂无订单数据" : "No order data"}
            />
        )
      }}
    />
  );
}

