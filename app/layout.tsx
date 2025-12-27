import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Skydimo",
	description: "Skydimo Subscription Management",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" data-theme="dark">
			<head>
				<link rel="icon" href="/favicon.png" type="image/png" />
			</head>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<AntdRegistry>
					<Script id="init-app-theme" strategy="beforeInteractive">
						{`(() => {
  try {
    var t = localStorage.getItem('appTheme');
    if (t !== 'light' && t !== 'dark') t = 'dark';
    document.documentElement.dataset.theme = t;
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();`}
					</Script>
					<Script id="init-app-language" strategy="beforeInteractive">
						{`(() => {
  try {
    var p = (location && location.pathname) ? location.pathname : '/';
    var seg = (p.split('/')[1] || '').toLowerCase();
    var lang = null;
    if (seg === 'en' || seg === 'en-us') lang = 'en-US';
    if (seg === 'zh' || seg === 'zh-cn' || seg === 'zh-hans') lang = 'zh-CN';

    if (lang !== 'zh-CN' && lang !== 'en-US') {
      // localStorage preference
      try {
        var stored = localStorage.getItem('appLanguage');
        if (stored === 'zh-CN' || stored === 'en-US') lang = stored;
      } catch (e) {}

      // cookie preference
      if (lang !== 'zh-CN' && lang !== 'en-US') {
        var m = document.cookie.match(/(?:^|;\\s*)appLanguage=([^;]+)/);
        if (m && m[1]) {
          try {
            var c = decodeURIComponent(m[1]);
            if (c === 'zh-CN' || c === 'en-US') lang = c;
          } catch (e) {}
        }
      }

      // navigator fallback
      if (lang !== 'zh-CN' && lang !== 'en-US') {
        var nav = (navigator && navigator.language ? navigator.language : '').toLowerCase();
        lang = nav.startsWith('en') ? 'en-US' : 'zh-CN';
      }
    }

    // Apply to document early (avoid SSR mismatch showing wrong language in incognito)
    document.documentElement.lang = (lang === 'en-US') ? 'en' : 'zh-CN';

    // Persist for hydration logic
    try { localStorage.setItem('appLanguage', lang); } catch (e) {}
    try {
      var secure = (location && location.protocol === 'https:') ? '; Secure' : '';
      document.cookie = 'appLanguage=' + encodeURIComponent(lang) + '; Path=/; Max-Age=' + (60*60*24*365) + '; SameSite=Lax' + secure;
    } catch (e) {}
  } catch (e) {}
})();`}
					</Script>
					{children}
				</AntdRegistry>
			</body>
		</html>
	);
}
