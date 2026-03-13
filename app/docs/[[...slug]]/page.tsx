import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/json-ld";
import { SiteHeader } from "@/components/site/site-header";
import { Sidebar } from "@/components/site/sidebar";
import { SidebarDrawer } from "@/components/site/sidebar-drawer";
import { Toc } from "@/components/site/toc";
import { getDocBreadcrumbs, getDocByPublicUrl, getAllDocParams, getSidebarItems } from "@/lib/docs/content";
import { renderMdxFromFile } from "@/lib/docs/mdx";
import {
  absoluteUrl,
  canonicalDocPath,
  defaultKeywords,
  defaultOgImage,
  docRobots,
  siteName,
} from "@/lib/seo/site";

type PageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

function routeFromParams(params: { slug?: string[] }) {
  return params.slug?.length ? `/docs/${params.slug.join("/")}` : "/docs";
}

export async function generateStaticParams() {
  return getAllDocParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const currentUrl = routeFromParams(await params);
  const doc = await getDocByPublicUrl(currentUrl);

  if (!doc) {
    return {
      title: "문서를 찾을 수 없습니다",
    };
  }

  const canonicalPath = canonicalDocPath(currentUrl);
  const keywords = [
    ...defaultKeywords,
    doc.title,
    doc.section ?? "",
    ...doc.headings.slice(0, 8).map((heading) => heading.text),
  ].filter(Boolean);

  return {
    title: doc.title,
    description: doc.description || doc.excerpt,
    keywords,
    alternates: {
      canonical: absoluteUrl(canonicalPath),
    },
    robots: docRobots(currentUrl),
    openGraph: {
      title: doc.title,
      description: doc.description || doc.excerpt,
      url: absoluteUrl(canonicalPath),
      type: "article",
      section: doc.section ?? undefined,
      publishedTime: doc.pubDate ? new Date(doc.pubDate).toISOString() : undefined,
      images: [
        {
          url: absoluteUrl(defaultOgImage),
          width: 1200,
          height: 630,
          alt: `${doc.title} | ${siteName}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${doc.title} | ${siteName}`,
      description: doc.description || doc.excerpt,
      images: [absoluteUrl(defaultOgImage)],
    },
  };
}

export default async function DocsPage({ params }: PageProps) {
  const currentUrl = routeFromParams(await params);
  const doc = await getDocByPublicUrl(currentUrl);

  if (!doc) notFound();

  const [Content, sidebarItems, breadcrumbs] = await Promise.all([
    renderMdxFromFile(doc.outputPathAbs, currentUrl),
    getSidebarItems(currentUrl),
    getDocBreadcrumbs(currentUrl),
  ]);
  const canonicalPath = canonicalDocPath(currentUrl);
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.title,
      item: absoluteUrl(index === breadcrumbs.length - 1 ? canonicalPath : crumb.href),
    })),
  };
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: doc.title,
    description: doc.description || doc.excerpt,
    url: absoluteUrl(canonicalPath),
    inLanguage: "ko-KR",
    learningResourceType: "Documentation",
    articleSection: doc.section ?? "docs",
    datePublished: doc.pubDate ? new Date(doc.pubDate).toISOString() : undefined,
    author: {
      "@type": "Organization",
      name: siteName,
    },
    publisher: {
      "@type": "Organization",
      name: siteName,
    },
    image: absoluteUrl(defaultOgImage),
    keywords: [
      doc.title,
      doc.section ?? "",
      ...doc.headings.slice(0, 8).map((heading) => heading.text),
    ].filter(Boolean),
  };

  return (
    <div className="page-root">
      <JsonLd data={[breadcrumbJsonLd, articleJsonLd]} />
      <SiteHeader />
      <main className="docs-shell">
        <aside className="docs-sidebar desktop-only">
          <Sidebar items={sidebarItems} />
        </aside>
        <div className="docs-main">
          <div className="docs-mobile-bar mobile-only">
            <SidebarDrawer items={sidebarItems} title={doc.title} />
          </div>
          <article className="docs-article">
            <div className="doc-breadcrumbs">
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb.href}-${index}`}>
                  {index > 0 ? <span className="crumb-slash">/</span> : null}
                  <Link href={crumb.href}>{crumb.title}</Link>
                </span>
              ))}
            </div>
            <header className="doc-header">
              <h1>{doc.title}</h1>
              {doc.description ? <p className="doc-description">{doc.description}</p> : null}
            </header>
            <div className="doc-prose">
              <Content />
            </div>
          </article>
        </div>
        <aside className="docs-toc desktop-wide-only">
          <Toc headings={doc.headings} />
        </aside>
      </main>
    </div>
  );
}
