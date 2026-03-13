"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SearchDialog = dynamic(
  () => import("@/components/site/search-modal").then((mod) => mod.SearchDialog),
  {
    loading: () => (
      <div className="search-modal-backdrop">
        <div className="search-modal" aria-busy="true" />
      </div>
    ),
  },
);

export function SearchLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }

      if (!open && event.key === "/") {
        const target = event.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
        event.preventDefault();
        setOpen(true);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <button type="button" className="search-button" onClick={() => setOpen(true)}>
        <span>문서 검색</span>
        <kbd>⌘K</kbd>
      </button>
      {open ? <SearchDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
