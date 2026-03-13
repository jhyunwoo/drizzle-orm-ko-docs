import Link from "next/link";

import { SearchLauncher } from "@/components/site/search-launcher";
import { ThemeToggle } from "@/components/site/theme-toggle";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">Drizzle</span>
          <span className="brand-copy">한국어 문서</span>
        </Link>
        <nav className="header-nav">
          <Link href="/docs/">문서</Link>
          <Link href="/docs/guides/">가이드</Link>
          <Link href="/docs/tutorials/">튜토리얼</Link>
          <Link href="/docs/latest-releases/">최신 릴리스</Link>
        </nav>
        <div className="header-actions">
          <SearchLauncher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
