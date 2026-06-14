---
name: import-loops-drafts
description: Import Loops draft newsletter campaigns into stoa.news Astro posts. Use when the user asks to import from Loops, sync draft emails, or convert Loops campaigns to markdown posts.
---

# Import Loops Drafts to stoa.news

## Prerequisites

- `LOOPS_API_KEY` in project `.env` (never commit this file)
- Loops Content API enabled for the team

## Command

```bash
pnpm import-loops
pnpm import-loops -- --dry-run
pnpm import-loops -- --campaign <campaignId>
pnpm import-loops -- --force
```

## What it does

1. Lists Loops campaigns with status `Draft`
2. Fetches each campaign's email message (`subject`, `lmx`)
3. Converts LMX to markdown (paragraphs, quotes, images, emphasis)
4. Strips newsletter chrome (header, edition line, footer links, CTA)
5. Writes `src/content/posts/<slug>.md` with frontmatter

## Output conventions

- Title from subject, with `Stoa N –` prefix removed
- Slug from title (ASCII, hyphenated)
- Images saved to `src/content/posts/_assets/<slug>-N.ext`
- Post footer links come from `PostFooter.astro`, not the email

## Related Loops skills

- `loops-api` — API reference
- `loops-cli` — terminal workflows
- `loops-lmx` — LMX markup details

## After import

1. Review generated markdown in Cursor
2. Fix edge cases manually if needed
3. Run `pnpm dev` and preview the post
4. Commit post + assets (never commit `.env`)
