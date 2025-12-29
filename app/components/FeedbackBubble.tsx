"use client";

import { useState, useRef, useEffect } from "react";
import { 
  FloatButton, 
  Popover, 
  Input, 
  Button, 
  Typography 
} from "antd";
import { 
  MessageOutlined, 
  CloseOutlined, 
  SendOutlined 
} from "@ant-design/icons";
import type { AppLanguage } from "../client-prefs";
import { getInitialLanguage } from "../client-prefs";
import { useOptionalUser } from "../contexts/UserContext";

const { TextArea } = Input;
const { Text } = Typography;

type FeedbackBubbleMessages = {
  title: string;
  placeholder: string;
  send: string;
  sending: string;
  successTitle: string;
  successMessage: string;
  warningMessage: string;
  errorMessage: string;
};

const messages: Record<AppLanguage, FeedbackBubbleMessages> = {
  "zh-CN": {
    title: "快速反馈",
    placeholder: "请输入您的问题或建议...",
    send: "发送",
    sending: "发送中...",
    successTitle: "感谢您的反馈！",
    successMessage: "我们会尽快处理您的反馈。",
    warningMessage: "已提交，但邮件通知未发送（不影响提交结果）。",
    errorMessage: "发送失败，请稍后再试",
  },
  "en-US": {
    title: "Quick Feedback",
    placeholder: "Enter your question or suggestion...",
    send: "Send",
    sending: "Sending...",
    successTitle: "Thank you for your feedback!",
    successMessage: "We will process your feedback as soon as possible.",
    warningMessage: "Submitted, but email notification was not sent.",
    errorMessage: "Failed to send, please try again later",
  },
};

export default function FeedbackBubble() {
  const userContext = useOptionalUser();
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  
  const [language, setLanguage] = useState<AppLanguage>(() => getInitialLanguage());
  const isSendingRef = useRef(false);

  const msg = messages[language];

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 监听语言切换事件
    const langHandler = (e: Event) => {
      const custom = e as CustomEvent<{ language: AppLanguage }>;
      if (custom.detail?.language) {
        setLanguage(custom.detail.language);
      }
    };

    window.addEventListener("app-language-changed", langHandler);
    return () => {
      window.removeEventListener("app-language-changed", langHandler);
    };
  }, []);

  const handleSend = async () => {
    if (!content.trim() || isSendingRef.current) return;

    isSendingRef.current = true;
    setSending(true);

    const userEmail = userContext?.profile?.email ?? null;

    try {
      const res = await fetch("/api/feedback/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          email: userEmail || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text() || msg.errorMessage);
      }

      type FeedbackQuickResponse = {
        ok: boolean;
        emailError?: string;
      };

      let data: FeedbackQuickResponse | null = null;
      try {
        data = (await res.json()) as FeedbackQuickResponse;
      } catch {
        // ignore
      }

      // 这里可以使用 Ant Design 的 message 或 notification 组件提示，但为了简单保持在 Popover 内或使用 alert
      // 由于这是客户端组件，最好使用 App 包裹后的 message，或者简单的状态切换
      // 为了用户体验，我们清空并关闭
      setContent("");
      setIsOpen(false);
      
      if (data?.emailError) {
        console.warn(data.emailError);
      }

    } catch (err) {
      console.error(err);
    } finally {
      isSendingRef.current = false;
      setSending(false);
    }
  };

  if (!userContext?.profile?.email) {
    return null;
  }

  const popoverContent = (
    <div style={{ width: 300 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
        <Text strong>{msg.title}</Text>
        <Button 
          type="text" 
          size="small" 
          icon={<CloseOutlined />} 
          onClick={() => setIsOpen(false)} 
        />
      </div>
      <TextArea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={msg.placeholder}
        rows={4}
        style={{ marginBottom: 12, resize: 'none' }}
        disabled={sending}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          type="primary" 
          icon={<SendOutlined />} 
          loading={sending}
          onClick={handleSend}
          disabled={!content.trim()}
        >
          {sending ? msg.sending : msg.send}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger="click"
      placement="topRight"
    >
      <FloatButton
        type="primary"
        icon={<MessageOutlined />}
        style={{ right: 24, bottom: 24 }}
        tooltip={msg.title}
        onClick={() => setIsOpen(!isOpen)}
      />
    </Popover>
  );
}
