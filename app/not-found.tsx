import type { Metadata } from "next";

import { SiteHeader } from "@/components/site/site-header";

export const metadata: Metadata = {
  title: "문서를 찾을 수 없습니다",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="page-root">
      <SiteHeader />
      <main className="empty-state-shell">
        <div className="empty-state-card">
          <div className="eyebrow">404</div>
          <h1>문서를 찾을 수 없습니다.</h1>
          <p>요청한 경로가 아직 생성되지 않았거나 잘못된 링크일 수 있습니다.</p>
          <a href="/docs/" className="primary-cta">
            문서 홈으로 이동
          </a>
        </div>
      </main>
    </div>
  );
}
