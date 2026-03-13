import Link from "next/link";

import type { SidebarItem } from "@/lib/docs/types";

export function Sidebar({ items }: { items: SidebarItem[] }) {
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
                  if (child.kind === "heading") {
                    return (
                      <div key={`subheading-${child.title}-${childIndex}`} className="sidebar-subheading">
                        {child.title}
                      </div>
                    );
                  }

                  if (child.kind === "divider") {
                    return <div key={`subdivider-${childIndex}`} className="sidebar-divider" />;
                  }

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
