"use client";

import { Avatar, Card, Descriptions, Space, Tag, Typography } from "antd";
import { formatDateTime, getClientTimeZone } from "../../../../_utils/dateTime";

export type UserDetail = {
  id?: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  isVip: boolean;
  vipExpiresAt: string | null;
  createdAt: string;
};

export function UserOverviewCard({
  user,
  language,
}: {
  user: UserDetail;
  language: "zh-CN" | "en-US";
}) {
  const viewerTz = getClientTimeZone();
  const roleTag = user.isAdmin ? (
    <Tag color="blue">{language === "zh-CN" ? "管理员" : "Admin"}</Tag>
  ) : (
    <Tag>{language === "zh-CN" ? "普通用户" : "User"}</Tag>
  );

  const vipTag = user.isVip ? (
    <Tag color="green">{language === "zh-CN" ? "会员" : "VIP"}</Tag>
  ) : (
    <Tag>{language === "zh-CN" ? "非会员" : "Non‑VIP"}</Tag>
  );

  return (
    <Card
      title={language === "zh-CN" ? "用户概览" : "User Overview"}
      style={{ width: "100%" }}
    >
      <Space align="start" size={16} style={{ width: "100%" }}>
        <Avatar
          size={56}
          src={user.avatarUrl || undefined}
          alt={user.username || user.email}
          className="app-avatar"
        >
          {(user.username || user.email || "U").trim().charAt(0).toUpperCase()}
        </Avatar>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Space direction="vertical" size={2} style={{ width: "100%" }}>
            <Space wrap size={8}>
              <Typography.Text strong style={{ fontSize: 16 }}>
                {user.username || (language === "zh-CN" ? "未命名用户" : "Unnamed")}
              </Typography.Text>
              {roleTag}
              {vipTag}
              {user.vipExpiresAt ? (
                <Typography.Text type="secondary">
                  {language === "zh-CN" ? "到期：" : "Expires:"}{" "}
                  {formatDateTime(user.vipExpiresAt, {
                    locale: language,
                    timeZone: viewerTz ?? undefined,
                  })}
                </Typography.Text>
              ) : null}
            </Space>
            <Typography.Text type="secondary" ellipsis>
              {user.email}
            </Typography.Text>
          </Space>

          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2, md: 3 }}
            style={{ marginTop: 12 }}
            items={[
              {
                key: "username",
                label: language === "zh-CN" ? "用户名" : "Username",
                children: user.username || "-",
              },
              {
                key: "email",
                label: language === "zh-CN" ? "邮箱" : "Email",
                children: user.email,
              },
              {
                key: "createdAt",
                label: language === "zh-CN" ? "注册时间" : "Created",
                children: formatDateTime(user.createdAt, {
                  locale: language,
                  timeZone: viewerTz ?? undefined,
                }),
              },
            ]}
          />
        </div>
      </Space>
    </Card>
  );
}


