# Milestone 3 Public Rendering Contract

สถานะ: approved design input สำหรับ public/site-server implementation

## URL and locale rules

- Public Site URLs use a locale segment: `/th/...`, `/en/...`, or any enabled locale code
- API and Admin routes do not add a locale prefix
- `/` keeps the existing locale selection/redirect behavior
- a disabled, unknown หรือ unpublished locale content path returns `404`
- missing translation returns `404` and must not fall back to another locale's CMS content

## Public API surface

- `GET /api/v1/public/content/{locale}/*path`
- `GET /api/v1/public/posts/{locale}`
- `GET /api/v1/public/posts/{locale}/{slug}`
- `GET /api/v1/public/menus/{locale}/{location}`
- `POST /api/v1/public/previews/exchange`

The `public` and `site-server` OpenAPI surfaces share read-only public schemas but keep
separate generated packages and immutable contract checksums.

## Published response

A successful content response contains only the selected published revision:

- locale and canonical path/slug
- visible structured blocks
- content kind, title, excerpt, published/updated timestamps
- published alternate locales only
- canonical, Open Graph and discoverability metadata
- menu/navigation projection when requested
- `version`, `etag` and `request_id`

Draft, review, scheduled, archived and preview-only content never appears in public lists,
sitemap, RSS, alternate links or ordinary JSON-LD.

## Error and cache semantics

- missing/unpublished content: `404 public_content_not_found`
- preview invalid/expired/replayed: `404 preview_not_found`
- no stale value available during upstream failure: `503` with `cache-control: no-store`
- preview responses: `cache-control: no-store`, `X-Robots-Tag: noindex, nofollow`
- published responses: bounded TTL, versioned `ETag`, and public cache key containing site,
  locale, path and content version
- publish/unpublish/redirect/menu mutation invalidates affected keys only after commit
- stale-on-error is allowed only inside configured stale TTL and never for preview/admin data

## SEO/GEO/AEO rules

- canonical and `hreflang` links are emitted only for published locale variants
- `x-default` points to the configured default published locale
- JSON-LD types are limited to visible data: Organization, WebSite, BreadcrumbList, Article,
  FAQ and any future type explicitly backed by rendered content
- GEO/AEO signals may include direct answer, definition, steps, comparison, key facts, author
  credentials, citations, dates and provenance only when those values are visible on the page
- no ranking, indexing or AI citation guarantee is made

## Preview rules

- issue requires authenticated CMS permission and binds user/content/revision
- exchange consumes a one-time hash atomically and checks expiry/audience
- raw token is never stored or logged; invalid, expired and replayed codes share the same 404
- preview rendering never enters shared cache or feeds and is always `noindex`/`no-store`
