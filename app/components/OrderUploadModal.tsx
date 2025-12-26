"use client";

import { useState } from "react";
import { Modal, Upload, Input, Button, message, Form, Alert } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import type { AppLanguage } from "../client-prefs";
import type { OrderSnapshot } from "./UserOrdersList";

const { Dragger } = Upload;
const { TextArea } = Input;

interface OrderUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (data: OrderSnapshot) => void;
  email: string;
  deviceId?: string | null; // Optional specific device ID
  language: AppLanguage;
}

export default function OrderUploadModal({
  open,
  onClose,
  onSuccess,
  email,
  deviceId,
  language,
}: OrderUploadModalProps) {
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (fileList.length === 0) {
      setError(language === "zh-CN" ? "请选择要上传的文件" : "Please select a file to upload");
      return;
    }

    const file = fileList[0].originFileObj;
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("email", email);
      if (deviceId) {
        formData.append("deviceId", deviceId);
      }
      formData.append("file", file);
      if (note.trim()) {
        formData.append("note", note.trim());
      }

      const res = await fetch("/api/user/orders", {
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
    onRemove: (file) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    },
    beforeUpload: (file) => {
      // Check file type if needed
      const isImage = file.type.startsWith("image/");
      if (!isImage) {
        message.error(language === "zh-CN" ? "只能上传图片文件!" : "You can only upload image files!");
        return Upload.LIST_IGNORE;
      }
      setFileList([file]); // Only allow 1 file
      return false; // Prevent auto upload
    },
    fileList,
    maxCount: 1,
  };

  const title = deviceId 
    ? (language === "zh-CN" ? `为设备 ${deviceId} 上传订单` : `Upload Order for Device ${deviceId}`)
    : (language === "zh-CN" ? "上传订单截图" : "Upload Order Screenshot");

  return (
    <Modal
      open={open}
      title={title}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          {language === "zh-CN" ? "取消" : "Cancel"}
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleUpload}
          disabled={fileList.length === 0}
        >
          {language === "zh-CN" ? "提交" : "Submit"}
        </Button>,
      ]}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

