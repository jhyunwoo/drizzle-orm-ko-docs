import type { MetadataRoute } from "next";

import { defaultOgImage, siteDescription, siteName } from "@/lib/seo/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: "Drizzle KO Docs",
    description: siteDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#0b7a75",
    lang: "ko-KR",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
      {
        src: defaultOgImage,
        sizes: "1200x630",
        type: "image/jpeg",
      },
    ],
  };
}
