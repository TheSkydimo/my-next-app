"use client";

import { useEffect } from "react";
import { Button, Form, Input, Modal, Space, Typography } from "antd";

type FormValues = {
  // YYYY-MM-DD or empty
  vipDate: string;
};

export function UserVipEditorModal({
  open,
  language,
  currentVipExpiresAt,
  loading,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  language: "zh-CN" | "en-US";
  currentVipExpiresAt: string | null;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (vipExpiresAt: string | null) => Promise<void> | void;
}) {
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (!open) return;
    const defaultDate = currentVipExpiresAt
      ? currentVipExpiresAt.slice(0, 10)
      : "";
    form.setFieldsValue({ vipDate: defaultDate });
  }, [currentVipExpiresAt, form, open]);

  const submit = async () => {
    const values = await form.validateFields();
    const trimmed = (values.vipDate ?? "").trim();
    if (!trimmed) {
      await onSubmit(null);
      return;
    }
    await onSubmit(`${trimmed}T23:59:59.999Z`);
  };

  return (
    <Modal
      open={open}
      title={language === "zh-CN" ? "设置会员到期时间" : "Set VIP Expiry"}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel} disabled={loading}>
            {language === "zh-CN" ? "取消" : "Cancel"}
          </Button>
          <Button type="primary" onClick={() => void submit()} loading={loading}>
            {language === "zh-CN" ? "保存" : "Save"}
          </Button>
        </Space>
      }
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        {language === "zh-CN"
          ? "输入 YYYY-MM-DD（留空表示取消会员）。保存后会按当日 23:59:59 作为到期时间。"
          : "Enter YYYY-MM-DD (empty means cancel VIP). We’ll use 23:59:59 of that day as expiry."}
      </Typography.Paragraph>

      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item
          label={language === "zh-CN" ? "到期日期" : "Expiry Date"}
          name="vipDate"
          rules={[
            {
              validator: async (_, value: string) => {
                const v = (value ?? "").trim();
                if (!v) return;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                  throw new Error(
                    language === "zh-CN"
                      ? "格式必须为 YYYY-MM-DD"
                      : "Format must be YYYY-MM-DD"
                  );
                }
                const t = new Date(`${v}T00:00:00.000Z`);
                if (Number.isNaN(t.getTime())) {
                  throw new Error(
                    language === "zh-CN" ? "日期不合法" : "Invalid date"
                  );
                }
              },
            },
          ]}
        >
          <Input
            placeholder="YYYY-MM-DD"
            maxLength={10}
            inputMode="numeric"
            disabled={loading}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}


