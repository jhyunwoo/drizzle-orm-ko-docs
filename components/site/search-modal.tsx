"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { SearchRecord } from "@/lib/docs/types";

function renderHighlight(text: string, query: string) {
  if (!query) return text;

  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`(${safe})`, "ig");
  const parts = text.split(matcher);

  return parts.map((part, index) =>
    matcher.test(part) ? <mark key={`${part}-${index}`}>{part}</mark> : part,
  );
}

export function SearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<SearchRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;

    fetch("/search-index.json", { cache: "force-cache" })
      .then((response) => response.json())
      .then((json) => {
        setRecords(json as SearchRecord[]);
        setLoaded(true);
      })
      .catch(() => {
        setRecords([]);
        setLoaded(true);
      });
  }, [loaded]);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return records.slice(0, 12);

    return records
      .map((record) => {
        const haystack = [record.title, record.description, record.excerpt, ...record.keywords]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const score = haystack.includes(trimmed)
          ? (record.title.toLowerCase().includes(trimmed) ? 3 : 1) +
            (record.url.includes("#") ? 0 : 1)
          : 0;

        return { record, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 16)
      .map((entry) => entry.record);
  }, [query, records]);

  return (
    <div className="search-modal-backdrop" onClick={onClose}>
      <div className="search-modal" onClick={(event) => event.stopPropagation()}>
        <div className="search-modal-header">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="한국어 키워드나 API 이름으로 검색"
          />
        </div>
        <div className="search-results">
          {results.map((record) => (
            <Link
              key={record.id}
              href={record.url}
              prefetch={false}
              className="search-result"
              onClick={onClose}
            >
              <div className="search-result-breadcrumb">{record.breadcrumb.join(" / ")}</div>
              <div className="search-result-title">{renderHighlight(record.title, query)}</div>
              <p className="search-result-excerpt">{renderHighlight(record.excerpt, query)}</p>
            </Link>
          ))}
          {!results.length ? <div className="search-empty">검색 결과가 없습니다.</div> : null}
        </div>
      </div>
    </div>
  );
}
