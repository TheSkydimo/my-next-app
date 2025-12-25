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
					{children}
				</AntdRegistry>
			</body>
		</html>
	);
}
