import fs from "node:fs/promises";
import path from "node:path";

import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import matter from "gray-matter";
import type { ComponentType } from "react";

import { Breadcrumbs } from "@/components/mdx/client-breadcrumbs";
import { Callout } from "@/components/mdx/client-callout";
import { GetStartedLinks } from "@/components/mdx/client-get-started-links";
import { Npm, Npx, NpxCompact } from "@/components/mdx/client-package-tabs";
import { CodeTab, CodeTabs, Tab, Tabs } from "@/components/mdx/client-tabs";
import {
  AnchorCards,
  BlogCards,
  Cards,
  CodeWithProps,
  Flex,
  Guides,
  Image,
  IsSupportedChip,
  IsSupportedChipGroup,
  LatestReleases,
  Link,
  LinksList,
  MdxLink,
  Prerequisites,
  RowCodeWrap,
  Section,
  SimpleLinkCards,
  Steps,
  SupportingTable,
  TableWrapper,
  Tag,
  Tutorials,
  WhatsNextMSSQL,
  WhatsNextPostgres,
  YoutubeCards,
} from "@/components/mdx/server-components";

const ROOT = process.cwd();
const componentCache = new Map<string, Promise<ComponentType<any>>>();

function extractTopImports(body: string) {
  const lines = body.split("\n");
  const imports: string[] = [];
  let index = 0;
  let sawImport = false;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      if (!sawImport) {
        index += 1;
        continue;
      }

      imports.push(line);
      index += 1;
      continue;
    }

    if (
      /^import\s.+from\s+['"][^'"]+['"];?$/.test(trimmed) ||
      /^export\s+(const|let|var|function|class)\s+/.test(trimmed)
    ) {
      imports.push(line);
      sawImport = true;
      index += 1;
      continue;
    }

    break;
  }

  return {
    imports,
    content: lines.slice(index).join("\n"),
  };
}

function parseImportLine(line: string) {
  const defaultImport = /^import\s+([A-Za-z0-9_$]+)\s+from\s+['"]([^'"]+)['"];?$/.exec(line.trim());
  if (defaultImport) {
    return { localName: defaultImport[1], source: defaultImport[2] };
  }

  const namedImport = /^import\s+\{\s*([A-Za-z0-9_$]+)\s*\}\s+from\s+['"]([^'"]+)['"];?$/.exec(
    line.trim(),
  );
  if (namedImport) {
    return { localName: namedImport[1], source: namedImport[2] };
  }

  return null;
}

function resolveImportSource(source: string, currentFilePath: string) {
  if (source.startsWith("@mdx-ko/")) {
    return path.join(ROOT, "src", "mdx-ko", source.replace("@mdx-ko/", ""));
  }

  if (source.startsWith("@mdx/")) {
    return path.join(ROOT, "src", "mdx", source.replace("@mdx/", ""));
  }

  if (source.startsWith("@components-ko/")) {
    return path.join(ROOT, "src", "ui", "components-ko", source.replace("@components-ko/", ""));
  }

  if (source.startsWith("@components/")) {
    return path.join(ROOT, "src", "ui", "components", source.replace("@components/", ""));
  }

  if (source.startsWith("@/assets/")) {
    return path.join(ROOT, "src", source.replace("@/", ""));
  }

  if (source.startsWith(".")) {
    return path.resolve(path.dirname(currentFilePath), source);
  }

  return source;
}

function getAstroRegistry(currentUrl: string) {
  return {
    a: MdxLink,
    AnchorCards,
    BlogCards,
    Breadcrumbs: () => <Breadcrumbs currentUrl={currentUrl} />,
    Callout,
    Cards,
    CodeTab,
    CodeTabs,
    CodeWithProps,
    Flex,
    GetStartedLinks,
    Guides,
    Image,
    IsSupportedChip,
    IsSupportedChipGroup,
    LatestReleases,
    Link,
    LinksList,
    Npm,
    Npx,
    NpxCompact,
    Prerequisites,
    RowCodeWrap,
    Section,
    SimpleLinkCards,
    Steps,
    SupportingTable,
    Tab,
    TableWrapper,
    Tabs,
    Tag,
    Tutorials,
    WhatsNextMSSQL,
    WhatsNextPostgres,
    YoutubeCards,
  } as Record<string, ComponentType<any>>;
}

async function resolveImportedComponents(currentFilePath: string, currentUrl: string, importLines: string[]) {
  const registry = getAstroRegistry(currentUrl);
  const injectedExports: string[] = [];
  const resolvedEntries = await Promise.all(
    importLines
      .map(parseImportLine)
      .filter(Boolean)
      .map(async (parsed) => {
        const resolved = resolveImportSource(parsed!.source, currentFilePath);

        if (parsed!.source === "astro:assets" && parsed!.localName === "Image") {
          return [parsed!.localName, registry.Image] as const;
        }

        if (resolved.includes(`${path.sep}src${path.sep}assets${path.sep}`)) {
          const publicAssetPath = resolved
            .replace(path.join(ROOT, "src"), "")
            .replace(/\\/g, "/");
          injectedExports.push(
            `export const ${parsed!.localName} = ${JSON.stringify(publicAssetPath)};`,
          );
          return null;
        }

        if (resolved.endsWith(".mdx")) {
          return [parsed!.localName, await compileMdxComponent(resolved, currentUrl)] as const;
        }

        if (resolved.endsWith(".astro")) {
          const componentName = path.basename(resolved, ".astro");
          const component = registry[parsed!.localName] ?? registry[componentName];
          if (!component) {
            throw new Error(`Unsupported Astro component: ${resolved}`);
          }

          return [parsed!.localName, component] as const;
        }

        const direct = registry[parsed!.localName];
        if (direct) return [parsed!.localName, direct] as const;

        return null;
      }),
  );

  return {
    components: Object.fromEntries(
      resolvedEntries.filter(Boolean) as Array<readonly [string, ComponentType<any>]>,
    ) as Record<string, ComponentType<any>>,
    injectedExports,
  };
}

async function compileMdxComponent(filePath: string, currentUrl: string) {
  const cacheKey = `${filePath}::${currentUrl}`;

  if (!componentCache.has(cacheKey)) {
    componentCache.set(
      cacheKey,
      (async () => {
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = matter(raw);
        const { imports, content } = extractTopImports(parsed.content);
        const { components: importedComponents, injectedExports } = await resolveImportedComponents(
          filePath,
          currentUrl,
          imports,
        );
        const prelude = [
          ...(Object.keys(parsed.data).length
            ? [`export const frontmatter = ${JSON.stringify(parsed.data)};`]
            : []),
          ...injectedExports,
        ];
        const source = prelude.length ? `${prelude.join("\n")}\n\n${content}` : content;

        const evaluated = await evaluate(source, {
          ...runtime,
          providerImportSource: "@mdx-js/react",
          useMDXComponents: () => ({
            ...getAstroRegistry(currentUrl),
            ...importedComponents,
          }),
          remarkPlugins: [remarkGfm],
          rehypePlugins: [
            rehypeSlug,
            [
              rehypeAutolinkHeadings,
              {
                behavior: "append",
                properties: {
                  className: ["heading-anchor"],
                  ariaLabel: "섹션 링크",
                },
                content: {
                  type: "text",
                  value: "#",
                },
              },
            ],
            [
              rehypePrettyCode,
              {
                theme: {
                  dark: "github-dark-default",
                  light: "github-light-default",
                },
                keepBackground: false,
              },
            ],
          ],
        } as any);

        return evaluated.default as ComponentType<any>;
      })(),
    );
  }

  return componentCache.get(cacheKey)!;
}

export async function renderMdxFromFile(filePath: string, currentUrl: string) {
  return compileMdxComponent(filePath, currentUrl);
}
