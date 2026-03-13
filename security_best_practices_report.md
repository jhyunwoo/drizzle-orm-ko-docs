# Security Best Practices Report

## Scope

- Project: Next.js static-export Korean Drizzle ORM docs site
- Date: 2026-03-13
- Reviewed areas: `app/`, `components/`, `lib/`, `public/`, static build output

## Findings

### P1: CSP is still pragmatic rather than strict

The deployment headers in `public/_headers` now provide a meaningful baseline CSP, but they still allow:

- `script-src 'self' 'unsafe-inline'`
- `style-src 'self' 'unsafe-inline'`

This is the main remaining security tradeoff. It is acceptable for the current static docs deployment because the site still needs inline JSON-LD and the docs corpus includes inline style patterns that would otherwise break rendering. If a stricter policy is required later, the next step is to remove inline script/style dependencies from the rendered output and move structured data to nonce- or hash-based delivery.

### P2: ESLint is skipped during production builds

`next.config.mjs` uses `eslint.ignoreDuringBuilds: true`. This is not an immediate vulnerability, but it does reduce pre-deploy guardrails. Static generation and type checking still pass, but lint-based security and quality regressions could slip through more easily than they should.

### P2: Search UI was an unnecessary always-mounted client feature

The search dialog logic used to be mounted in the header on every page. This was a performance concern more than a direct security issue. It has now been changed so the dialog is loaded only when the user opens search, which reduces initial client-side work on first render.

## Improvements Applied

### Security hardening

- Added deployment headers in `public/_headers`:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: DENY`
  - `Permissions-Policy: camera=(), geolocation=(), microphone=(), browsing-topics=()`
  - `Cross-Origin-Opener-Policy: same-origin`
  - baseline `Content-Security-Policy`
- Disabled the `X-Powered-By` header through `next.config.mjs`.
- Moved theme initialization into `public/theme-init.js` and loaded it with `beforeInteractive`, reducing inline executable script in the layout.
- Restricted active `dangerouslySetInnerHTML` usage to JSON-LD output in `components/seo/json-ld.tsx`, with `<` escaped before injection.
- Removed unsafe HTML rendering from search result highlighting and media card descriptions.
- Verified active external links opened in a new tab use `rel="nofollow noreferrer"`.

### Performance-oriented deployment optimizations

- Search records are emitted as minified JSON rather than pretty-printed JSON.
- Search excerpts were shortened and keyword arrays deduplicated to reduce payload size.
- `public/search-index.json` is now `920,532` bytes.
- Added long-lived immutable caching for static assets:
  - `/_next/static/*`
  - `/assets/*`
  - `/svg/*`
  - `/drizzle-studio.jpg`
- Added revalidation-friendly caching for `/search-index.json`.
- Converted active internal navigation links to `next/link` where appropriate.
- Disabled automatic prefetching on high-cardinality link surfaces such as the sidebar, search results, document-body links, and large index lists to reduce unnecessary route prefetch traffic.
- Added lazy loading and async decoding for MDX-rendered images.
- Split the search dialog out of the initial header path with dynamic import so it loads only when opened.

## Verification

- `bun run build` completed successfully on 2026-03-13.
- Static export completed successfully.
- Generated app routes: `247`
- Exported docs pages under `out/docs/**/index.html`: `240`
- Verified exported deployment artifacts:
  - `out/_headers`
  - `out/search-index.json`
  - `out/robots.txt`
  - `out/sitemap.xml`
- Active code scan results:
  - `dangerouslySetInnerHTML`: only `components/seo/json-ld.tsx`
  - `target="_blank"` in active runtime code: only vetted MDX/server component renderers with `rel` present

## Residual Recommendations

1. Re-enable ESLint in CI or as a dedicated pre-deploy check, even if build-time lint stays disabled locally.
2. If the final hosting platform does not honor `_headers`, mirror the same rules in the platform dashboard or deployment config.
3. Set `NEXT_PUBLIC_SITE_URL` to the production origin so canonical URLs, sitemap entries, robots host values, and Open Graph URLs are all correct.
4. If a stricter CSP becomes a requirement, budget a follow-up pass to eliminate inline style/script dependencies from rendered docs content.
