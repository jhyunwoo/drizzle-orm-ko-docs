"use client";

import Link from "next/link";
import { useState } from "react";

import type { SidebarItem } from "@/lib/docs/types";

function SidebarContent({ items }: { items: SidebarItem[] }) {
  return (
    <div className="sidebar-list">
      {items.map((item, index) => {
        if (item.kind === "divider") return <div key={`divider-${index}`} className="sidebar-divider" />;
        if (item.kind === "heading") {
          return (
            <div key={`heading-${item.title}-${index}`} className="sidebar-heading">
              {item.title}
            </div>
          );
        }

        return (
          <div key={item.href} className="sidebar-item-group">
            <Link
              href={item.href}
              prefetch={false}
              className={item.active ? "sidebar-link is-active" : "sidebar-link"}
            >
              {item.title}
            </Link>
            {item.children?.length ? (
              <div className="sidebar-sublist">
                {item.children.map((child, childIndex) => {
                  if (child.kind !== "link") return null;

                  return (
                    <Link
                      key={`${child.href}-${childIndex}`}
                      href={child.href}
                      prefetch={false}
                      className="sidebar-sublink"
                    >
                      {child.title}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function SidebarDrawer({
  items,
  title,
}: {
  items: SidebarItem[];
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="mobile-sidebar-button" onClick={() => setOpen(true)}>
        메뉴
      </button>
      {open ? (
        <div className="mobile-sidebar-backdrop" onClick={() => setOpen(false)}>
          <aside className="mobile-sidebar-panel" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-sidebar-header">
              <div>{title ?? "문서 탐색"}</div>
              <button type="button" className="header-icon-button" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
            <SidebarContent items={items} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
