import { notFound } from "next/navigation";
import type { AppLanguage } from "../../api/_utils/appLanguage";
import { resolveAppLanguageFromLocaleSegment } from "../../_utils/routeLang";
import LangRouteClient from "./LangRouteClient";
import LangRedirectToOrdersClient from "./LangRedirectToOrdersClient";

export default async function LangHomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: segment } = await params;
  const resolved = resolveAppLanguageFromLocaleSegment(segment);
  if (!resolved) notFound();

  // IMPORTANT:
  // Next.js only allows mutating cookies in Route Handlers / Server Actions.
  // Pages are Server Components, so we set language on the client (localStorage + cookie)
  // via `applyLanguage()` in LangRouteClient.
  const store: AppLanguage = resolved;

  return (
    <LangRouteClient lang={store}>
      <LangRedirectToOrdersClient />
    </LangRouteClient>
  );
}


