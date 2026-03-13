import type { DocHeading } from "@/lib/docs/types";

export function Toc({ headings }: { headings: DocHeading[] }) {
  if (!headings.length) return null;

  return (
    <div className="toc-card">
      <div className="toc-title">이 페이지에서</div>
      <div className="toc-list">
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={heading.depth === 3 ? "toc-link is-nested" : "toc-link"}
          >
            {heading.text}
          </a>
        ))}
      </div>
    </div>
  );
}
