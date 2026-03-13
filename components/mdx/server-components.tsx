import NextLink from "next/link";
import type { CSSProperties, ReactNode } from "react";

import {
  getGuideDocs,
  getLatestReleaseDocs,
  getTutorialDocs,
} from "@/lib/docs/content";
import { isExternalUrl, replaceTextTokens } from "@/components/mdx/utils";

function normalizeAsset(value: string) {
  return value.replace(/^\/public/, "");
}

export function MdxLink({
  href = "",
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const external = isExternalUrl(href);
  const internal = href.startsWith("/") || href.startsWith("#");

  if (internal && !external) {
    return (
      <NextLink href={href} prefetch={false} {...props}>
        {children}
      </NextLink>
    );
  }

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "nofollow noopener noreferrer" : undefined}
      {...props}
    >
      {children}
    </a>
  );
}

export function Image({
  src,
  alt = "",
  className,
  width,
  height,
}: {
  src: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
    />
  );
}

export function Section({ children }: { children: ReactNode }) {
  return <div className="mdx-section">{children}</div>;
}

export function Steps({ children }: { children: ReactNode }) {
  return <div className="steps-block">{children}</div>;
}

export function Flex({ children }: { children: ReactNode }) {
  return <div className="flex-links">{children}</div>;
}

export function Tag({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties | string;
}) {
  const resolvedStyle =
    typeof style === "string"
      ? Object.fromEntries(
          style
            .split(";")
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => {
              const [key, value] = entry.split(":").map((part) => part.trim());
              const camelKey = key.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
              return [camelKey, value];
            }),
        )
      : style;

  return (
    <div className="tag" style={resolvedStyle}>
      {children}
    </div>
  );
}

export function Prerequisites({ children }: { children: ReactNode }) {
  return (
    <div className="prerequisites">
      <div className="prerequisites-title">이 문서는 다음 내용을 이미 알고 있다고 가정합니다:</div>
      {children}
    </div>
  );
}

export function LinksList({
  title,
  links,
}: {
  title?: string;
  links: [string, string][];
}) {
  return (
    <div className="links-list">
      {title ? <p className="links-list-title">{title}</p> : null}
      <div className="links-list-items">
        {links.map(([name, href]) => (
          <MdxLink key={`${name}-${href}`} href={href} className="links-list-link">
            <span className="links-list-icon">▣</span>
            {name}
          </MdxLink>
        ))}
      </div>
    </div>
  );
}

export function AnchorCards({ cards }: { cards: Record<string, string> }) {
  return (
    <div className="anchor-card-grid">
      {Object.entries(cards).map(([label, href]) => (
        <a key={label} href={href} className="anchor-card">
          <span className="anchor-card-mark">#</span>
          <span>{label}</span>
        </a>
      ))}
    </div>
  );
}

export function SimpleLinkCards({ cards }: { cards: Record<string, string> }) {
  return (
    <div className="simple-card-grid">
      {Object.entries(cards).map(([label, href]) => (
        <a key={label} href={href} className="simple-card">
          <span>{label}</span>
          <span className="simple-card-arrow">›</span>
        </a>
      ))}
    </div>
  );
}

export function IsSupportedChip({
  text,
  isSupported,
}: {
  text: string;
  isSupported: boolean;
}) {
  return (
    <div className="support-chip">
      <span className={isSupported ? "support-chip-icon is-supported" : "support-chip-icon"}>
        {isSupported ? "✓" : "⏳"}
      </span>
      <span>{text}</span>
    </div>
  );
}

export function IsSupportedChipGroup({
  chips,
  joined,
}: {
  chips: Record<string, boolean>;
  joined?: boolean;
}) {
  return (
    <div className={joined ? "support-chip-group is-joined" : "support-chip-group"}>
      {Object.entries(chips).map(([text, isSupported]) => (
        <IsSupportedChip key={text} text={text} isSupported={isSupported} />
      ))}
    </div>
  );
}

export function TableWrapper({ children }: { children: ReactNode }) {
  return <div className="table-wrapper">{children}</div>;
}

export function CodeWithProps({
  children,
  ...props
}: {
  children: ReactNode;
  [key: string]: string | ReactNode;
}) {
  const replacements = Object.fromEntries(
    Object.entries(props).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  return <>{replaceTextTokens(children, replacements)}</>;
}

export function YoutubeCards({
  cards,
}: {
  cards: Array<{
    id: string;
    imageUrl?: string;
    title: string;
    description?: string;
    time: string;
  }>;
}) {
  const toPlainText = (value: string) => value.replace(/<[^>]+>/g, "").trim();

  return (
    <div className="media-card-grid">
      {cards.map((card) => {
        const imageUrl = card.imageUrl ?? `https://img.youtube.com/vi/${card.id}/maxresdefault.jpg`;
        const href = `https://driz.link/yt/${card.id}`;

        return (
          <a
            key={card.id}
            href={href}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="media-card"
          >
            <div className="media-card-image">
              <img src={imageUrl} alt={toPlainText(card.title)} loading="lazy" decoding="async" />
              <span className="media-card-time">{card.time}</span>
            </div>
            <div className="media-card-body">
              <div className="media-card-title">{toPlainText(card.title)}</div>
              {card.description ? (
                <p className="media-card-description">{toPlainText(card.description)}</p>
              ) : null}
            </div>
          </a>
        );
      })}
    </div>
  );
}

export function BlogCards({
  cards,
}: {
  cards: Array<{
    href: string;
    imageUrl: string;
    title: string;
    description?: string;
  }>;
}) {
  const toPlainText = (value: string) => value.replace(/<[^>]+>/g, "").trim();

  return (
    <div className="media-card-grid">
      {cards.map((card) => (
        <a
          key={card.href}
          href={card.href}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="media-card"
        >
          <div className="media-card-image">
            <img src={card.imageUrl} alt={toPlainText(card.title)} loading="lazy" decoding="async" />
          </div>
          <div className="media-card-body">
            <div className="media-card-title">{toPlainText(card.title)}</div>
            {card.description ? <p className="media-card-description">{toPlainText(card.description)}</p> : null}
          </div>
        </a>
      ))}
    </div>
  );
}

export function SupportingTable({
  category,
  items,
}: {
  category: string;
  items: Array<{
    name: string;
    isSupported: boolean;
    docsLink?: string;
    websiteLink?: string;
  }>;
}) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>{category}</th>
            <th>지원 여부</th>
            <th>문서</th>
            <th>웹사이트</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.name}>
              <td>{item.name}</td>
              <td>{item.isSupported ? "지원" : "준비 중"}</td>
              <td>{item.docsLink ? <a href={item.docsLink}>Docs</a> : null}</td>
              <td>
                {item.websiteLink ? (
                  <a href={item.websiteLink} target="_blank" rel="nofollow noopener noreferrer">
                    Website
                  </a>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RowCodeWrap({ children }: { children: ReactNode }) {
  return <div className="row-code-wrap">{children}</div>;
}

export async function Guides() {
  const docs = await getGuideDocs(24);

  return (
    <section className="index-list-block">
      <h2>가이드</h2>
      <p>자주 쓰는 작업을 단계별로 따라갈 수 있도록 정리한 코드 예제와 실전 안내 모음입니다.</p>
      <div className="index-list">
        {docs.map((doc) => (
          <NextLink key={doc.publicUrl} href={doc.publicUrl} prefetch={false} className="index-list-link">
            {doc.title}
          </NextLink>
        ))}
      </div>
    </section>
  );
}

export async function Tutorials() {
  const docs = await getTutorialDocs(24);

  return (
    <section className="index-list-block">
      <h2>튜토리얼</h2>
      <div className="index-list">
        {docs.map((doc) => (
          <NextLink key={doc.publicUrl} href={doc.publicUrl} prefetch={false} className="index-list-link">
            {doc.title}
          </NextLink>
        ))}
      </div>
    </section>
  );
}

export async function LatestReleases() {
  const docs = await getLatestReleaseDocs(24);

  return (
    <section className="index-list-block">
      <h2>최신 릴리스</h2>
      <div className="release-card-grid">
        {docs.map((doc) => (
          <NextLink key={doc.publicUrl} href={doc.publicUrl} prefetch={false} className="release-card">
            <div className="release-card-title">{doc.title}</div>
            <div className="release-card-date">
              {doc.pubDate ? new Date(doc.pubDate).toLocaleDateString("ko-KR") : ""}
            </div>
            <div className="release-card-description">{doc.description}</div>
          </NextLink>
        ))}
      </div>
    </section>
  );
}

export function Cards({
  cards,
}: {
  cards: Record<
    string,
    {
      title: string;
      description?: string;
      href: string;
      imageSrc: string | { lightThemeSrc: string; darkThemeSrc: string };
      lightStyle?: CSSProperties;
      darkStyle?: CSSProperties;
    }
  >;
}) {
  return (
    <div className="card-grid">
      {Object.entries(cards).map(([key, card]) => {
        const lightPath =
          typeof card.imageSrc === "string"
            ? normalizeAsset(card.imageSrc)
            : normalizeAsset(card.imageSrc.lightThemeSrc);
        const darkPath =
          typeof card.imageSrc === "string"
            ? normalizeAsset(card.imageSrc)
            : normalizeAsset(card.imageSrc.darkThemeSrc);

        return (
          <a key={key} href={card.href} className="doc-card">
            <div className="doc-card-icon light-only">
              <img src={lightPath} alt="" style={card.lightStyle} />
            </div>
            <div className="doc-card-icon dark-only">
              <img src={darkPath} alt="" style={card.darkStyle} />
            </div>
            <div className="doc-card-title">{card.title}</div>
            {card.description ? <div className="doc-card-description">{card.description}</div> : null}
          </a>
        );
      })}
    </div>
  );
}

export function Link({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <MdxLink href={href} className={className}>
      {children}
    </MdxLink>
  );
}

export async function WhatsNextPostgres() {
  return (
    <Flex>
      <LinksList
        title="스키마 관리"
        links={[
          ["Drizzle 스키마", "/docs/sql-schema-declaration"],
          ["PostgreSQL 데이터 타입", "/docs/column-types/pg"],
          ["인덱스와 제약 조건", "/docs/indexes-constraints"],
          ["데이터베이스 뷰", "/docs/views"],
          ["데이터베이스 스키마", "/docs/schemas"],
          ["시퀀스", "/docs/sequences"],
          ["확장 기능", "/docs/extensions/pg"],
        ]}
      />
      <LinksList
        title="데이터 조회"
        links={[
          ["관계형 쿼리", "/docs/rqb"],
          ["조회", "/docs/select"],
          ["삽입", "/docs/insert"],
          ["수정", "/docs/update"],
          ["삭제", "/docs/delete"],
          ["필터", "/docs/operators"],
          ["조인", "/docs/joins"],
          ["sql`` 연산자", "/docs/sql"],
        ]}
      />
    </Flex>
  );
}

export async function WhatsNextMSSQL() {
  return (
    <Flex>
      <LinksList
        title="스키마 관리"
        links={[
          ["Drizzle 스키마", "/docs/sql-schema-declaration"],
          ["MSSQL 데이터 타입", "/docs/column-types/mssql"],
          ["인덱스와 제약 조건", "/docs/indexes-constraints"],
          ["데이터베이스 뷰", "/docs/views"],
          ["데이터베이스 스키마", "/docs/schemas"],
        ]}
      />
      <LinksList
        title="데이터 조회"
        links={[
          ["조회", "/docs/select"],
          ["삽입", "/docs/insert"],
          ["수정", "/docs/update"],
          ["삭제", "/docs/delete"],
          ["필터", "/docs/operators"],
          ["조인", "/docs/joins"],
          ["sql`` 연산자", "/docs/sql"],
        ]}
      />
    </Flex>
  );
}
