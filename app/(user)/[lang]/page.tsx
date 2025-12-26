import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { AppLanguage } from "../../api/_utils/appLanguage";
import { resolveAppLanguageFromLocaleSegment } from "../../_utils/routeLang";
import UserHomePage from "../_pages/UserHomePage";
import LangRouteClient from "./LangRouteClient";

export default async function LangHomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: segment } = await params;
  const resolved = resolveAppLanguageFromLocaleSegment(segment);
  if (!resolved) notFound();

  // Align with `/api/lang/sync`: preference cookie is not sensitive and must be readable by client JS
  // so it can hydrate localStorage on first load.
  const store: AppLanguage = resolved;
  const cookieStore = await cookies();
  cookieStore.set({
    name: "appLanguage",
    value: store,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return (
    <LangRouteClient lang={store}>
      <UserHomePage />
    </LangRouteClient>
  );
}


