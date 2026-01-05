import { notFound } from "next/navigation";
import { resolveAppLanguageFromLocaleSegment } from "../../_utils/routeLang";
import { redirect } from "next/navigation";

export default async function LangHomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: segment } = await params;
  const resolved = resolveAppLanguageFromLocaleSegment(segment);
  if (!resolved) notFound();

  // We never render the "home" page for locale-prefixed entry.
  // Instead, use the dedicated route handler to set `appLanguage` cookie and then land on `/orders`.
  const from = resolved === "zh-CN" ? "zh" : "en";
  redirect(`/api/lang/sync?from=${encodeURIComponent(from)}&next=/orders`);
}


