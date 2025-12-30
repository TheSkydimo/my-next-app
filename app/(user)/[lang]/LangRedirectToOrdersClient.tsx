"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Typography } from "antd";

export default function LangRedirectToOrdersClient() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/orders");
  }, [router]);

  return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <Typography.Text type="secondary">Redirecting...</Typography.Text>
    </div>
  );
}


