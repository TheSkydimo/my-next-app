"use client";

import { useLayoutEffect } from "react";
import { applyLanguage, type AppLanguage } from "../../client-prefs";

export default function LangRouteClient({
  lang,
  children,
}: {
  lang: AppLanguage;
  children: React.ReactNode;
}) {
  // Use layout effect to apply language before paint (reduces first-render flicker).
  useLayoutEffect(() => {
    applyLanguage(lang);
  }, [lang]);

  return children;
}


