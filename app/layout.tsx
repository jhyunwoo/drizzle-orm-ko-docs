import type { Metadata } from "next";
import Script from "next/script";

import "@/app/globals.css";
import {
  absoluteUrl,
  defaultKeywords,
  defaultOgImage,
  language,
  locale,
  organizationName,
  siteDescription,
  siteName,
  siteUrl,
} from "@/lib/seo/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: defaultKeywords,
  category: "technology",
  alternates: {
    canonical: absoluteUrl("/"),
  },
  authors: [{ name: organizationName }],
  creator: organizationName,
  publisher: organizationName,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: siteName,
    description: siteDescription,
    url: absoluteUrl("/"),
    siteName,
    locale,
    type: "website",
    images: [
      {
        url: absoluteUrl(defaultOgImage),
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: [absoluteUrl(defaultOgImage)],
  },
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={language} suppressHydrationWarning>
      <body>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
