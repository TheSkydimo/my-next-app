"use client";

import { useMemo, useState } from "react";
import { Button, Image, Space, Table, Typography } from "antd";

export type AdminOrderItem = {
  id: number;
  userEmail: string;
  deviceId: string;
  imageUrl: string;
  note: string | null;
  createdAt: string;
  orderNo?: string | null;
  orderCreatedTime?: string | null;
  orderPaidTime?: string | null;
};

function formatDateTime(input: string) {
  const t = new Date(input);
  if (Number.isNaN(t.getTime())) return input;
  return t.toLocaleString();
}

export function UserOrdersTable({
  items,
  language,
}: {
  items: AdminOrderItem[];
  language: "zh-CN" | "en-US";
}) {
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});

  const columns = useMemo(() => {
    return [
      {
        title: language === "zh-CN" ? "时间" : "Time",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 180,
        render: (v: string) => (
          <Typography.Text type="secondary">{formatDateTime(v)}</Typography.Text>
        ),
      },
      {
        title: language === "zh-CN" ? "设备 ID" : "Device ID",
        dataIndex: "deviceId",
        key: "deviceId",
        width: 220,
        render: (v: string) => (
          <Typography.Text code style={{ fontSize: 12 }}>
            {v}
          </Typography.Text>
        ),
      },
      {
        title: language === "zh-CN" ? "截图" : "Screenshot",
        dataIndex: "imageUrl",
        key: "imageUrl",
        width: 120,
        render: (_: string, row: AdminOrderItem) => {
          const isBroken = !!brokenImages[row.id];
          if (isBroken) {
            return (
              <Space direction="vertical" size={4}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {language === "zh-CN"
                    ? "无法预览（可能是 HEIC 等格式）"
                    : "Preview unavailable (e.g. HEIC)"}
                </Typography.Text>
                <Space size={6}>
                  <Button size="small" href={row.imageUrl} target="_blank">
                    {language === "zh-CN" ? "打开" : "Open"}
                  </Button>
                  <Button size="small" href={row.imageUrl} download>
                    {language === "zh-CN" ? "下载" : "Download"}
                  </Button>
                </Space>
              </Space>
            );
          }

          return (
            <Image
              width={64}
              height={64}
              style={{ objectFit: "cover", borderRadius: 8 }}
              src={row.imageUrl}
              alt="order"
              preview
              onError={() =>
                setBrokenImages((prev) => ({ ...prev, [row.id]: true }))
              }
            />
          );
        },
      },
      {
        title: language === "zh-CN" ? "备注" : "Note",
        dataIndex: "note",
        key: "note",
        render: (v: string | null) =>
          v ? (
            <Typography.Paragraph style={{ margin: 0 }} ellipsis={{ rows: 2 }}>
              {v}
            </Typography.Paragraph>
          ) : (
            <Typography.Text type="secondary">-</Typography.Text>
          ),
      },
    ] as const;
  }, [brokenImages, language]);

  return (
    <Table<AdminOrderItem>
      rowKey="id"
      size="middle"
      dataSource={items}
      columns={[...columns] as unknown as never}
      pagination={false}
      expandable={{
        expandedRowRender: (row) => (
          <Space direction="vertical" size={6} style={{ width: "100%" }}>
            <Space size={12} wrap>
              <Typography.Text type="secondary">
                {language === "zh-CN" ? "订单号：" : "Order No:"}
              </Typography.Text>
              <Typography.Text>{row.orderNo || "-"}</Typography.Text>
            </Space>
            <Space size={12} wrap>
              <Typography.Text type="secondary">
                {language === "zh-CN" ? "创建时间：" : "Created:"}
              </Typography.Text>
              <Typography.Text>{row.orderCreatedTime || "-"}</Typography.Text>
            </Space>
            <Space size={12} wrap>
              <Typography.Text type="secondary">
                {language === "zh-CN" ? "付款时间：" : "Paid:"}
              </Typography.Text>
              <Typography.Text>{row.orderPaidTime || "-"}</Typography.Text>
            </Space>
          </Space>
        ),
        rowExpandable: (row) =>
          !!row.orderNo || !!row.orderCreatedTime || !!row.orderPaidTime,
      }}
    />
  );
}


