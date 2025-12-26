"use client";

import { useEffect } from "react";
import { applyLanguage, type AppLanguage } from "../../client-prefs";

export default function LangRouteClient({
  lang,
  children,
}: {
  lang: AppLanguage;
  children: React.ReactNode;
}) {
  useEffect(() => {
    applyLanguage(lang);
  }, [lang]);

  return children;
}


