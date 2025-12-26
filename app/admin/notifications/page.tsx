
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminNotificationsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/notifications/send");
  }, [router]);

  return null;
}
