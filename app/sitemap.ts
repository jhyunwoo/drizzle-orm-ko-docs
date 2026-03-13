import type { MetadataRoute } from "next";

import fs from "node:fs/promises";
import path from "node:path";

import { getManifest } from "@/lib/docs/content";
import { absoluteUrl } from "@/lib/seo/site";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const manifest = await getManifest();
  const entries = await Promise.all(
    manifest
      .filter((entry) => entry.publicUrl !== "/docs/overview")
      .map(async (entry) => {
        const stats = await fs.stat(path.join(process.cwd(), entry.outputPath));
        return {
          url: absoluteUrl(entry.publicUrl),
          lastModified: stats.mtime,
          changeFrequency: "weekly" as const,
          priority: entry.publicUrl.startsWith("/docs/latest-releases/")
            ? 0.6
            : entry.publicUrl.startsWith("/docs/guides/")
              ? 0.8
              : 0.7,
        };
      }),
  );

  return [
    {
      url: absoluteUrl("/"),
      changeFrequency: "weekly",
      lastModified: new Date(),
      priority: 1,
    },
    {
      url: absoluteUrl("/docs"),
      changeFrequency: "weekly",
      lastModified: new Date(),
      priority: 0.9,
    },
    ...entries,
  ];
}
