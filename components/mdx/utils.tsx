import React from "react";

export function isExternalUrl(href: string) {
  try {
    const url = new URL(href, "https://local.test");
    return url.origin !== "https://local.test";
  } catch {
    return false;
  }
}

export function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node)) return extractText(node.props.children);
  return "";
}

export function replaceTextTokens(
  node: React.ReactNode,
  replacements: Record<string, string>,
): React.ReactNode {
  if (node === null || node === undefined || typeof node === "boolean") return node;

  if (typeof node === "string") {
    return Object.entries(replacements).reduce(
      (acc, [key, value]) => acc.replaceAll(`$${key}$`, value),
      node,
    );
  }

  if (typeof node === "number") return node;

  if (Array.isArray(node)) {
    return node.map((child, index) => <React.Fragment key={index}>{replaceTextTokens(child, replacements)}</React.Fragment>);
  }

  if (React.isValidElement(node)) {
    return React.cloneElement(node, {
      ...node.props,
      children: replaceTextTokens(node.props.children, replacements),
    });
  }

  return node;
}

export function childArray(children: React.ReactNode) {
  return React.Children.toArray(children);
}
