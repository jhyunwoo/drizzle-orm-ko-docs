import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { SiteHeader } from "@/components/site/site-header";
import {
  getDocCount,
  getAllDocs,
  getFeaturedDocs,
  getGuideDocs,
  getLatestReleaseDocs,
  getTutorialDocs,
} from "@/lib/docs/content";
import { absoluteUrl, defaultKeywords, defaultOgImage, siteDescription, siteName } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "홈",
  description:
    "Drizzle ORM 한국어 문서 포털에서 시작하기, 가이드, 튜토리얼, 최신 릴리스까지 한 번에 탐색하세요.",
  keywords: [...defaultKeywords, "Drizzle ORM 가이드", "Drizzle ORM 튜토리얼"],
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: siteName,
    description:
      "Drizzle ORM 한국어 문서 포털에서 시작하기, 가이드, 튜토리얼, 최신 릴리스까지 한 번에 탐색하세요.",
    url: absoluteUrl("/"),
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
    description:
      "Drizzle ORM 한국어 문서 포털에서 시작하기, 가이드, 튜토리얼, 최신 릴리스까지 한 번에 탐색하세요.",
    images: [absoluteUrl(defaultOgImage)],
  },
};

export default async function HomePage() {
  const [featuredDocs, guides, releases, tutorials, allDocs] = await Promise.all([
    getFeaturedDocs(),
    getGuideDocs(6),
    getLatestReleaseDocs(4),
    getTutorialDocs(4),
    getAllDocs(),
  ]);
  const docCount = getDocCount(allDocs);
  const homeJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteName,
      description: siteDescription,
      url: absoluteUrl("/"),
      inLanguage: "ko-KR",
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: siteName,
      description: siteDescription,
      url: absoluteUrl("/"),
      inLanguage: "ko-KR",
      isPartOf: {
        "@type": "WebSite",
        name: siteName,
        url: absoluteUrl("/"),
      },
      mainEntity: {
        "@type": "ItemList",
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: featuredDocs.length,
        itemListElement: featuredDocs.map((doc, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: doc.title,
          url: absoluteUrl(doc.publicUrl),
        })),
      },
    },
  ];

  return (
    <div className="page-root">
      <JsonLd data={homeJsonLd} />
      <SiteHeader />
      <main className="home-shell">
        <section className="hero-card">
          <div className="hero-copy">
            <div className="eyebrow">Static Docs Portal</div>
            <h1>Drizzle ORM 한국어 문서를 한곳에서 탐색하세요.</h1>
            <p>
              번역된 전체 문서를 정적 사이트로 제공하고, 빠른 검색과 섹션 탐색, 라이트/다크 모드를
              함께 지원합니다.
            </p>
            <div className="hero-actions">
              <Link href="/docs/" prefetch={false} className="primary-cta">
                문서 바로 보기
              </Link>
              <Link href="/docs/get-started/" prefetch={false} className="secondary-cta">
                시작하기
              </Link>
            </div>
          </div>
          <div className="hero-stats">
            <div className="stat-card">
              <div className="stat-value">{docCount}</div>
              <div className="stat-label">정적 생성 문서</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">245</div>
              <div className="stat-label">번역 완료 경로</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">MDX</div>
              <div className="stat-label">App Router 기반</div>
            </div>
          </div>
        </section>

        <section className="feature-grid">
          {featuredDocs.map((doc) => (
            <Link key={doc.publicUrl} href={doc.publicUrl} prefetch={false} className="feature-card">
              <div className="feature-card-title">{doc.title}</div>
              <p>{doc.description || doc.excerpt}</p>
            </Link>
          ))}
        </section>

        <section className="home-section-grid">
          <div className="home-section-card">
            <div className="home-section-header">
              <h2>대표 가이드</h2>
              <Link href="/docs/guides/" prefetch={false}>모두 보기</Link>
            </div>
            <div className="home-link-list">
              {guides.map((doc) => (
                <Link key={doc.publicUrl} href={doc.publicUrl} prefetch={false} className="home-link-item">
                  {doc.title}
                </Link>
              ))}
            </div>
          </div>

          <div className="home-section-card">
            <div className="home-section-header">
              <h2>튜토리얼</h2>
              <Link href="/docs/tutorials/" prefetch={false}>모두 보기</Link>
            </div>
            <div className="home-link-list">
              {tutorials.map((doc) => (
                <Link key={doc.publicUrl} href={doc.publicUrl} prefetch={false} className="home-link-item">
                  {doc.title}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="home-section-card home-release-section">
          <div className="home-section-header">
            <h2>최신 릴리스</h2>
            <Link href="/docs/latest-releases/" prefetch={false}>릴리스 아카이브</Link>
          </div>
          <div className="release-card-grid">
            {releases.map((doc) => (
              <Link key={doc.publicUrl} href={doc.publicUrl} prefetch={false} className="release-card">
                <div className="release-card-title">{doc.title}</div>
                <div className="release-card-date">
                  {doc.pubDate ? new Date(doc.pubDate).toLocaleDateString("ko-KR") : ""}
                </div>
                <div className="release-card-description">{doc.description || doc.excerpt}</div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
