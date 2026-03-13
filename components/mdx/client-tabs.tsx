"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { childArray } from "@/components/mdx/utils";

interface TabsProps {
  items: string[];
  children: ReactNode;
}

function BaseTabs({
  items,
  children,
  variant,
}: TabsProps & { variant: "tabs" | "code" }) {
  const panels = useMemo(() => childArray(children), [children]);
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className={variant === "code" ? "code-tabs" : "content-tabs"}>
      <div className="tab-strip" role="tablist" aria-label="문서 탭">
        {items.map((item, index) => (
          <button
            key={`${item}-${index}`}
            type="button"
            role="tab"
            aria-selected={activeIndex === index}
            className={activeIndex === index ? "tab-button is-active" : "tab-button"}
            onClick={() => setActiveIndex(index)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className={variant === "code" ? "code-tab-panels" : "tab-panels"}>
        {panels.map((panel, index) => (
          <div
            key={index}
            role="tabpanel"
            hidden={activeIndex !== index}
            className={activeIndex === index ? "tab-panel is-active" : "tab-panel"}
          >
            {panel}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Tabs(props: TabsProps) {
  return <BaseTabs {...props} variant="tabs" />;
}

export function CodeTabs(props: TabsProps) {
  return <BaseTabs {...props} variant="code" />;
}

export function Tab({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function CodeTab({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
