"use client";

import { useState } from "react";
import { Modal, Upload, Input, Button, message, Form, Alert } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import type { AppLanguage } from "../client-prefs";
import type { OrderSnapshot } from "./UserOrdersList";
import { apiFetch } from "../lib/apiFetch";

const { Dragger } = Upload;
const { TextArea } = Input;

interface OrderUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (data: OrderSnapshot) => void;
  deviceId?: string | null; // Optional specific device ID
  language: AppLanguage;
}

export default function OrderUploadModal({
  open,
  onClose,
  onSuccess,
  deviceId,
  language,
}: OrderUploadModalProps) {
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const maxBytes = 8 * 1024 * 1024; // keep consistent with server-side cap

  const isImageFile = (file: File) => {
    const type = String(file.type || "");
    if (type.startsWith("image/")) return true;
    // Some browsers / drag sources may not provide a MIME type; fall back to extension.
    const name = String(file.name || "").toLowerCase();
    return (
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".webp") ||
      name.endsWith(".gif") ||
      name.endsWith(".bmp") ||
      name.endsWith(".heic")
    );
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      setError(language === "zh-CN" ? "请选择要上传的文件" : "Please select a file to upload");
      return;
    }

    const file = fileList[0]?.originFileObj;
    if (!(file instanceof File)) {
      setError(language === "zh-CN" ? "请选择要上传的文件" : "Please select a file to upload");
      return;
    }

    if (typeof file.size === "number" && file.size > maxBytes) {
      setError(language === "zh-CN" ? "图片过大（最大 8MB）" : "Image is too large (max 8MB)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      if (deviceId) {
        formData.append("deviceId", deviceId);
      }
      formData.append("file", file);
      if (note.trim()) {
        formData.append("note", note.trim());
      }

      const res = await apiFetch(`/api/user/orders?lang=${encodeURIComponent(language)}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || (language === "zh-CN" ? "上传失败" : "Upload failed"));
      }

      const data = (await res.json()) as OrderSnapshot;
      message.success(language === "zh-CN" ? "上传成功" : "Upload successful");
      onSuccess(data);
      handleClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (language === "zh-CN" ? "上传失败" : "Upload failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFileList([]);
    setNote("");
    setError("");
    onClose();
  };

  const uploadProps: UploadProps = {
    beforeUpload: (file) => {
      if (!isImageFile(file)) {
        message.error(language === "zh-CN" ? "只能上传图片文件!" : "You can only upload image files!");
        return Upload.LIST_IGNORE;
      }
      if (typeof file.size === "number" && file.size > maxBytes) {
        message.error(language === "zh-CN" ? "图片过大（最大 8MB）" : "Image is too large (max 8MB)");
        return Upload.LIST_IGNORE;
      }
      // Use onChange to populate UploadFile (with originFileObj).
      return false; // Prevent auto upload
    },
    onChange: (info) => {
      // Only allow 1 file, keep the latest.
      const next = (info.fileList ?? []).slice(-1);
      setFileList(next);
      if (next.length > 0) setError("");
    },
    onRemove: () => {
      setFileList([]);
      setError("");
    },
    fileList,
    maxCount: 1,
    disabled: loading,
  };

  const title = deviceId 
    ? (language === "zh-CN" ? `为设备 ${deviceId} 上传订单` : `Upload Order for Device ${deviceId}`)
    : (language === "zh-CN" ? "上传订单截图" : "Upload Order Screenshot");

  return (
    <Modal
      open={open}
      title={title}
      onCancel={handleClose}
      maskClosable={!loading}
      closable={!loading}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={loading}>
          {language === "zh-CN" ? "取消" : "Cancel"}
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleUpload}
          disabled={fileList.length === 0 || loading}
        >
          {language === "zh-CN" ? "提交" : "Submit"}
        </Button>,
      ]}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Alert
          type="info"
          showIcon
          message={
            language === "zh-CN"
              ? "上传前请确认截图包含“订单号/订单编号”，否则会识别失败"
              : "Before uploading, make sure the screenshot includes an Order Number/Order ID, otherwise recognition will fail"
          }
          description={
            <div>
              <div style={{ marginBottom: 8 }}>
                {language === "zh-CN"
                  ? "建议上传电商订单详情页/发票截图，需清晰可读："
                  : "Recommended: upload an e-commerce order details or invoice screenshot. The following should be clearly readable:"}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>
                  {language === "zh-CN" ? "订单号/订单编号（必须）" : "Order number / Order ID (required)"}
                </li>
                <li>
                  {language === "zh-CN"
                    ? "平台/店铺信息（推荐）"
                    : "Platform / shop information (recommended)"}
                </li>
                <li>
                  {language === "zh-CN"
                    ? "下单时间、付款时间（推荐）"
                    : "Order created time & paid time (recommended)"}
                </li>
                <li>
                  {language === "zh-CN"
                    ? "购买数量（推荐）"
                    : "Purchased quantity (recommended)"}
                </li>
              </ul>
              <div style={{ marginTop: 8 }}>
                {language === "zh-CN"
                  ? `仅支持图片，且大小不超过 8MB；同一订单号只能提交一次。`
                  : "Images only, up to 8MB; the same order number can only be submitted once."}
              </div>
            </div>
          }
        />

        {error && <Alert type="error" message={error} showIcon />}
        
        <Dragger {...uploadProps} style={{ padding: 20 }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            {language === "zh-CN" ? "点击或拖拽文件到此区域上传" : "Click or drag file to this area to upload"}
          </p>
          <p className="ant-upload-hint">
            {language === "zh-CN" ? "支持单次上传一张图片" : "Support for a single upload."}
          </p>
        </Dragger>

        <Form.Item label={language === "zh-CN" ? "备注" : "Note"}>
          <TextArea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={language === "zh-CN" ? "请输入备注信息（可选）" : "Enter note (optional)"}
          />
        </Form.Item>
      </div>
    </Modal>
  );
}

