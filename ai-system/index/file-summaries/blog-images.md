# Blog Images Utility + Studio Components

**Paths:** `app/lib/utils/blogImages.ts`, `app/components/features/blog/BlogImageUpload.tsx`, `app/components/features/blog/BlogPostArticle.tsx`

**Purpose (Sprint 54):** Full blog image lifecycle. `blogImages.ts` is pure/client+server-safe/never-throws: `resolveBlogImageUrl` (safe cover fallback), `hasCustomBlogImage`, `extractBlogInlineImageUrls` (`<img src>` only), `collectBlogPostImageUrls` (cover + inline), `diffRemovedBlogUrls` (replacement set). `BlogImageUpload` is the reusable cover/inline picker (eager `folder=blog` upload, URL paste, swap-now/purge-after-save via `onReplaced`). `BlogPostArticle` is the shared reading view rendered by both the public `[slug]` page and the Studio live preview (parity by construction).

**Key exports:** `resolveBlogImageUrl`, `hasCustomBlogImage`, `extractBlogInlineImageUrls`, `collectBlogPostImageUrls`, `diffRemovedBlogUrls`, default `BlogImageUpload`, default `BlogPostArticle`
