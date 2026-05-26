# Stoa News

A minimal personal blog built with [Astro](https://astro.build), based on the [Chiri](https://github.com/the3ash/astro-chiri) theme.

## Features

- Static site generation with Astro
- Responsive light-theme layout
- Markdown and MDX posts
- KaTeX math, link cards, embeds, and more
- RSS, Atom, sitemap, and per-post Open Graph images

## Getting started

```bash
pnpm install
pnpm dev
```

Edit site settings in `src/config.ts` and the homepage blurb in `src/content/about/about.md`.

Create posts with `pnpm new "Post title"` (prefix with `_` for drafts, e.g. `pnpm new "_Draft title"`).

Build for production:

```bash
pnpm build
```

Deploy the `dist/` directory to [GitHub Pages](https://pages.github.com/), Netlify, or any static host.

## Commands

- `pnpm dev` — local dev server (refreshes link-card metadata first)
- `pnpm build` — production build
- `pnpm new <title>` — create a new post
- `pnpm update-link-metadata` — refresh `::link` card metadata
- `pnpm update-theme` — pull updates from upstream Chiri

## License

MIT
