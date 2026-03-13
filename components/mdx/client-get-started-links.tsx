"use client";

import { useState } from "react";

import { getStartedItems } from "@/src/mdx-ko/GetStartedLinks/data";

function normalizeIconPath(value: string) {
  return value.replace(/^\/public/, "");
}

export function GetStartedLinks() {
  const [mode, setMode] = useState<"new" | "existing">("new");

  return (
    <div className="get-started-links">
      <div className="get-started-toggle">
        <button
          type="button"
          className={mode === "new" ? "pill-toggle is-active" : "pill-toggle"}
          onClick={() => setMode("new")}
        >
          새 데이터베이스
        </button>
        <button
          type="button"
          className={mode === "existing" ? "pill-toggle is-active" : "pill-toggle"}
          onClick={() => setMode("existing")}
        >
          기존 데이터베이스
        </button>
      </div>
      <div className="get-started-groups">
        {getStartedItems.map((group) => (
          <section key={group.title} className="get-started-group">
            <div className="tag">{group.title}</div>
            <div className="get-started-grid">
              {group.items.map((item) => (
                <a key={item.name} href={item.path[mode]} className="get-started-card">
                  <span className="icon-box icon-box-light">
                    <img
                      src={normalizeIconPath(item.icon.light.path)}
                      alt=""
                      aria-hidden="true"
                      style={item.icon.light.style}
                    />
                  </span>
                  <span className="icon-box icon-box-dark">
                    <img
                      src={normalizeIconPath(item.icon.dark.path)}
                      alt=""
                      aria-hidden="true"
                      style={item.icon.dark.style}
                    />
                  </span>
                  <span>{item.name}</span>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
