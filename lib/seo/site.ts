export const siteName = "Drizzle ORM 한국어 문서";
export const siteDescription =
  "Drizzle ORM의 전체 한국어 문서를 정적 사이트로 제공하는 문서 포털입니다.";
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://drizzle-orm-docs-ko.local";
export const defaultOgImage = "/drizzle-studio.jpg";
export const locale = "ko_KR";
export const language = "ko-KR";
export const organizationName = "Drizzle ORM 한국어 문서";
export const defaultKeywords = [
  "Drizzle ORM",
  "Drizzle ORM 한국어",
  "Drizzle ORM 문서",
  "TypeScript ORM",
  "SQL ORM",
  "Drizzle Kit",
  "PostgreSQL",
  "MySQL",
  "SQLite",
];

export function absoluteUrl(pathname = "/") {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/+$/, "") + "/";
  return new URL(normalized, siteUrl).toString();
}

export function canonicalDocPath(currentUrl: string) {
  if (currentUrl === "/docs/overview") return "/docs";
  return currentUrl;
}

export function docRobots(currentUrl: string) {
  if (currentUrl === "/docs/overview") {
    return {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    };
  }

  return {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large" as const,
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  };
}
