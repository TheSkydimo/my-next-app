"use client";

import { useMemo, useState } from "react";
import { Button, Grid, Image, Popconfirm, Space, Table, Typography } from "antd";
import { formatDateTime, getClientTimeZone } from "../../../../_utils/dateTime";

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
  platform?: string | null;
  shopName?: string | null;
  deviceCount?: number | null;
};

export function UserOrdersTable({
  items,
  language,
  showUserEmail = false,
  onDelete,
  actionLoadingId,
}: {
  items: AdminOrderItem[];
  language: "zh-CN" | "en-US";
  showUserEmail?: boolean;
  onDelete?: (row: AdminOrderItem) => void;
  actionLoadingId?: number | null;
}) {
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});
  const viewerTz = getClientTimeZone();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const columns = useMemo(() => {
    const cols: unknown[] = [];

    if (showUserEmail) {
      cols.push({
        title: language === "zh-CN" ? "用户邮箱" : "User Email",
        dataIndex: "userEmail",
        key: "userEmail",
        width: 220,
        render: (v: string) => (
          <Typography.Text style={{ fontSize: 12 }}>{v}</Typography.Text>
        ),
      });
    }

    cols.push(
      {
        title: language === "zh-CN" ? "时间" : "Time",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 180,
        render: (v: string) => (
          <Typography.Text type="secondary">
            {formatDateTime(v, { locale: language, timeZone: viewerTz ?? undefined })}
          </Typography.Text>
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
        title: language === "zh-CN" ? "店铺/平台" : "Shop/Platform",
        key: "shop",
        responsive: ["md"],
        render: (_: unknown, row: AdminOrderItem) => (
          <Typography.Text>
            {(row.shopName || "-") + " / " + (row.platform || "-")}
          </Typography.Text>
        ),
      },
      {
        title: language === "zh-CN" ? "订单号" : "Order No",
        dataIndex: "orderNo",
        key: "orderNo",
        responsive: ["md"],
        render: (v: string | null | undefined, row: AdminOrderItem) => (
          <Typography.Text>
            {v || String(row.id)}
          </Typography.Text>
        ),
      },
      {
        title: language === "zh-CN" ? "创建时间" : "Created",
        dataIndex: "orderCreatedTime",
        key: "orderCreatedTime",
        responsive: ["lg"],
        render: (v: string | null | undefined, row: AdminOrderItem) => (
          <Typography.Text type="secondary">
            {v
              ? formatDateTime(v, { locale: language, timeZone: viewerTz ?? undefined })
              : formatDateTime(row.createdAt, { locale: language, timeZone: viewerTz ?? undefined })}
          </Typography.Text>
        ),
      },
      {
        title: language === "zh-CN" ? "付款时间" : "Paid",
        dataIndex: "orderPaidTime",
        key: "orderPaidTime",
        responsive: ["xl"],
        render: (v: string | null | undefined) => (
          <Typography.Text type="secondary">
            {v ? formatDateTime(v, { locale: language, timeZone: viewerTz ?? undefined }) : "-"}
          </Typography.Text>
        ),
      },
      {
        title: language === "zh-CN" ? "数量" : "Qty",
        dataIndex: "deviceCount",
        key: "deviceCount",
        width: 90,
        align: "center",
        render: (v: number | null | undefined) => v ?? "-",
      },
      {
        title: language === "zh-CN" ? "备注" : "Note",
        dataIndex: "note",
        key: "note",
        responsive: ["md"],
        render: (v: string | null) =>
          v ? (
            <Typography.Paragraph style={{ margin: 0 }} ellipsis={{ rows: 2 }}>
              {v}
            </Typography.Paragraph>
          ) : (
            <Typography.Text type="secondary">-</Typography.Text>
          ),
      },
    );

    if (onDelete) {
      cols.push({
        title: language === "zh-CN" ? "操作" : "Actions",
        key: "actions",
        width: 140,
        render: (_: unknown, row: AdminOrderItem) => {
          const loading = actionLoadingId === row.id;
          return (
            <Space wrap size={8}>
              {onDelete ? (
                <Popconfirm
                  title={language === "zh-CN" ? "确认删除该订单？" : "Delete this order?"}
                  description={
                    language === "zh-CN"
                      ? "该操作不可撤销，将同时删除截图文件。"
                      : "This action cannot be undone and will delete the screenshot."
                  }
                  okText={language === "zh-CN" ? "删除" : "Delete"}
                  cancelText={language === "zh-CN" ? "取消" : "Cancel"}
                  okButtonProps={{ danger: true }}
                  onConfirm={() => onDelete(row)}
                >
                  <Button size="small" danger disabled={loading}>
                    {language === "zh-CN" ? "删除" : "Delete"}
                  </Button>
                </Popconfirm>
              ) : null}
            </Space>
          );
        },
      });
    }

    return cols;
  }, [actionLoadingId, brokenImages, language, onDelete, showUserEmail]);

  return (
    <Table<AdminOrderItem>
      rowKey="id"
      size={isMobile ? "small" : "middle"}
      dataSource={items}
      columns={[...columns] as unknown as never}
      pagination={false}
      scroll={{ x: "max-content" }}
      expandable={{
        expandedRowRender: (row) => (
          <Space direction="vertical" size={6} style={{ width: "100%" }}>
            <Space size={12} wrap>
              <Typography.Text type="secondary">
                {language === "zh-CN" ? "店铺/平台：" : "Shop/Platform:"}
              </Typography.Text>
              <Typography.Text>
                {(row.platform || "-") + " / " + (row.shopName || "-")}
              </Typography.Text>
            </Space>
            <Space size={12} wrap>
              <Typography.Text type="secondary">
                {language === "zh-CN" ? "数量：" : "Qty:"}
              </Typography.Text>
              <Typography.Text>{row.deviceCount ?? "-"}</Typography.Text>
            </Space>
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
              <Typography.Text>
                {row.orderCreatedTime
                  ? formatDateTime(row.orderCreatedTime, {
                      locale: language,
                      timeZone: viewerTz ?? undefined,
                    })
                  : "-"}
              </Typography.Text>
            </Space>
            <Space size={12} wrap>
              <Typography.Text type="secondary">
                {language === "zh-CN" ? "付款时间：" : "Paid:"}
              </Typography.Text>
              <Typography.Text>
                {row.orderPaidTime
                  ? formatDateTime(row.orderPaidTime, {
                      locale: language,
                      timeZone: viewerTz ?? undefined,
                    })
                  : "-"}
              </Typography.Text>
            </Space>
          </Space>
        ),
        rowExpandable: (row) =>
          !!row.orderNo ||
          !!row.orderCreatedTime ||
          !!row.orderPaidTime ||
          !!row.platform ||
          !!row.shopName ||
          typeof row.deviceCount === "number",
      }}
    />
  );
}


