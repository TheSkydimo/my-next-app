"use client";

import { useState } from "react";
import { Modal, Upload, Input, Button, Alert, notification, theme } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import type { AppLanguage } from "../client-prefs";
import type { OrderSnapshot } from "./UserOrdersList";
import { apiFetch } from "../lib/apiFetch";
import OrderUploadTipsCard from "./OrderUploadTipsCard";

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
  const { token } = theme.useToken();

  const [notificationApi, notificationContextHolder] = notification.useNotification({
    placement: "topRight",
    showProgress: true,
    pauseOnHover: true,
    maxCount: 2,
  });

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
      // Capture uploader's IANA timezone for correct server-side normalization (DST-safe).
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) formData.append("tz", tz);
      } catch {
        // ignore
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
      notificationApi.success({
        message: language === "zh-CN" ? "上传成功" : "Upload successful",
        duration: 2.2,
      });
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
        notificationApi.error({
          message: language === "zh-CN" ? "只能上传图片文件" : "Images only",
          description: language === "zh-CN" ? "请上传 PNG/JPG/WEBP 等图片格式。" : "Please upload an image file (PNG/JPG/WEBP, etc).",
          duration: 2.8,
        });
        return Upload.LIST_IGNORE;
      }
      if (typeof file.size === "number" && file.size > maxBytes) {
        notificationApi.error({
          message: language === "zh-CN" ? "图片过大" : "Image is too large",
          description: language === "zh-CN" ? "最大支持 8MB。" : "Max size is 8MB.",
          duration: 2.8,
        });
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
      centered
      onCancel={handleClose}
      maskClosable={!loading}
      closable={!loading}
      wrapClassName="upload-modal-overlay"
      className="upload-modal-content order-upload-modal"
      width="min(920px, 94vw)"
      styles={{
        body: {
          // Keep a comfortable aspect ratio on short viewports:
          // - make the modal wider on large screens (less vertical stacking)
          // - cap body height and scroll internally when needed
          maxHeight: "calc(100vh - 240px)",
          overflowY: "auto",
        },
      }}
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
      {notificationContextHolder}
      <div className="order-upload-modal__grid">
        <div className="order-upload-modal__left">
          <OrderUploadTipsCard language={language} maxBytes={maxBytes} />
        </div>

        <div className="order-upload-modal__right">
          {error && <Alert type="error" message={error} showIcon />}

          <Dragger {...uploadProps} style={{ padding: 20 }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: token.colorTextSecondary }} />
            </p>
            <p className="ant-upload-text" style={{ color: token.colorTextSecondary }}>
              {language === "zh-CN"
                ? "点击或拖拽文件到此区域上传"
                : "Click or drag file to this area to upload"}
            </p>
            <p className="ant-upload-hint" style={{ color: token.colorTextTertiary }}>
              {language === "zh-CN" ? "支持单次上传一张图片" : "Support for a single upload."}
            </p>
          </Dragger>

          <TextArea
            aria-label={language === "zh-CN" ? "说明（可选）" : "Note (optional)"}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={language === "zh-CN" ? "请输入说明（可选）" : "Enter note (optional)"}
          />
        </div>
      </div>
    </Modal>
  );
}

