"use client";

import { useState } from "react";
import type { ReactNode } from "react";

interface CalloutProps {
  type?: "default" | "info" | "warning" | "error";
  title?: string;
  collapsed?: string;
  children: ReactNode;
}

export function Callout({
  type = "default",
  title,
  collapsed,
  children,
}: CalloutProps) {
  const [isCollapsed, setIsCollapsed] = useState(Boolean(collapsed));
  const resolvedTitle =
    title ?? (type === "warning" ? "중요" : type === "error" ? "경고" : undefined);

  return (
    <div className={`callout-root type-${type}`}>
      {resolvedTitle ? <div className={`callout-label type-${type}`}>{resolvedTitle}</div> : null}
      <div
        className={isCollapsed ? "callout-panel is-collapsed" : "callout-panel"}
        onClick={isCollapsed ? () => setIsCollapsed(false) : undefined}
      >
        {collapsed ? (
          <div className="callout-actions">
            <button
              type="button"
              aria-label={isCollapsed ? "확장" : "접기"}
              className="callout-toggle"
              onClick={(event) => {
                event.stopPropagation();
                setIsCollapsed((value) => !value);
              }}
            >
              <span className="callout-toggle-icon">{isCollapsed ? "↕" : "↔"}</span>
            </button>
            {isCollapsed ? <p className="callout-collapsed-label">{collapsed}</p> : null}
          </div>
        ) : null}
        {!isCollapsed ? <div className="callout-content">{children}</div> : null}
      </div>
    </div>
  );
}
