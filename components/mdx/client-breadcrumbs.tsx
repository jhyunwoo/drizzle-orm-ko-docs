"use client";

import { useMemo, useState } from "react";

import { getStartedItems } from "@/src/mdx-ko/GetStartedLinks/data";

interface BreadcrumbsProps {
  currentUrl: string;
}

export function Breadcrumbs({ currentUrl }: BreadcrumbsProps) {
  const flatItems = useMemo(() => getStartedItems.flatMap((group) => group.items), []);
  const currentItem = useMemo(
    () =>
      flatItems.find((item) => currentUrl === item.path.new || currentUrl === item.path.existing) ??
      flatItems[0],
    [currentUrl, flatItems],
  );

  const initialType = currentItem && currentUrl === currentItem.path.existing ? "existing" : "new";
  const [databaseType, setDatabaseType] = useState<"new" | "existing">(initialType);
  const [databaseName, setDatabaseName] = useState(currentItem?.name ?? flatItems[0]?.name ?? "");

  const item = flatItems.find((entry) => entry.name === databaseName) ?? currentItem;

  return (
    <div className="doc-breadcrumbs doc-breadcrumbs-interactive">
      <span>Drizzle 시작하기</span>
      <span className="crumb-dot" />
      <a href="/docs/get-started">시작하기</a>
      <span className="crumb-dot" />
      <select
        aria-label="데이터베이스 상태"
        value={databaseType}
        onChange={(event) => {
          const nextType = event.target.value as "new" | "existing";
          setDatabaseType(nextType);
          if (item) window.location.href = item.path[nextType];
        }}
      >
        <option value="new">새 데이터베이스</option>
        <option value="existing">기존 데이터베이스</option>
      </select>
      <span className="crumb-dot" />
      <select
        aria-label="데이터베이스 선택"
        value={databaseName}
        onChange={(event) => {
          const nextName = event.target.value;
          setDatabaseName(nextName);
          const nextItem = flatItems.find((entry) => entry.name === nextName);
          if (nextItem) window.location.href = nextItem.path[databaseType];
        }}
      >
        {flatItems.map((entry) => (
          <option key={entry.name} value={entry.name}>
            {entry.name}
          </option>
        ))}
      </select>
    </div>
  );
}
