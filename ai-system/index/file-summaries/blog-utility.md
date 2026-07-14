# Blog Utility

**Path:** `app/lib/utils/blog.ts`

**Purpose:** Server-side utility for reading MDX blog posts from `app/(public)/blog/posts/`. Parses frontmatter (title, description, date, author, category, image, readingTime), exposes `getAllPosts()` and `getPostBySlug()`. Uses `fs` module — build-time only.

**Key exports:** `BlogPostFrontmatter`/`BlogPost` (types), `getAllPosts`, `getPostBySlug`
