"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { extractText } from "@/components/mdx/utils";

const STORAGE_KEY = "drizzle-docs-package-manager";

function PackageTabs({
  commands,
  children,
}: {
  commands: string[];
  children: ReactNode;
}) {
  const managers = ["npm", "yarn", "pnpm", "bun"];
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const savedIndex = saved ? managers.indexOf(saved) : -1;
    if (savedIndex >= 0) setActiveIndex(savedIndex);
  }, []);

  const lines = useMemo(() => {
    const text = extractText(children).replaceAll("—", "--");
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }, [children]);

  const code = useMemo(
    () => lines.map((line) => `${commands[activeIndex]} ${line}`.trim()).join("\n"),
    [activeIndex, commands, lines],
  );

  return (
    <div className="package-tabs">
      <div className="tab-strip" role="tablist" aria-label="패키지 매니저 선택">
        {managers.map((manager, index) => (
          <button
            key={manager}
            type="button"
            className={activeIndex === index ? "tab-button is-active" : "tab-button"}
            onClick={() => {
              setActiveIndex(index);
              window.localStorage.setItem(STORAGE_KEY, manager);
            }}
          >
            {manager}
          </button>
        ))}
      </div>
      <figure className="package-code">
        <button
          type="button"
          className="copy-chip"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? "복사됨" : "복사"}
        </button>
        <pre>
          <code>{code}</code>
        </pre>
      </figure>
    </div>
  );
}

export function Npm({ children }: { children: ReactNode }) {
  return <PackageTabs commands={["npm i", "yarn add", "pnpm add", "bun add"]}>{children}</PackageTabs>;
}

export function Npx({ children }: { children: ReactNode }) {
  return <PackageTabs commands={["npx", "yarn", "pnpm", "bunx"]}>{children}</PackageTabs>;
}

export function NpxCompact({ children }: { children: ReactNode }) {
  return <PackageTabs commands={["npx", "yarn", "pnpm", "bunx"]}>{children}</PackageTabs>;
}
