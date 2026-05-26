/**
 * Import posts from stoa.news (Substack) into src/content/posts
 * Usage: tsx scripts/import-stoa-posts.ts [--force]
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseHtml } from 'node-html-parser'
import process from 'node:process'

const SITE = 'https://www.stoa.news'
const POSTS_DIR = join('src/content/posts')
const ASSETS_DIR = join(POSTS_DIR, '_assets')
const FORCE = process.argv.includes('--force')

const SKIP_SLUGS = new Set(['stoa-64-o-fenomeno-do-designer-mediocre'])

interface SubstackPost {
  title: string
  subtitle: string
  post_date: string
  slug: string
  body_html: string
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
  return response.text()
}

function unescapeEmbeddedJson(raw: string): unknown {
  return JSON.parse(JSON.parse(`"${raw}"`))
}

function parsePreloads(html: string): SubstackPost | null {
  const marker = 'window._preloads = JSON.parse("'
  const start = html.indexOf(marker)
  if (start === -1) return null

  let index = start + marker.length
  let raw = ''

  while (index < html.length) {
    const char = html[index]
    if (char === '\\') {
      raw += html.slice(index, index + 2)
      index += 2
      continue
    }
    if (char === '"') break
    raw += char
    index += 1
  }

  try {
    const json = unescapeEmbeddedJson(raw) as { post?: SubstackPost }
    if (!json?.post?.body_html) return null
    return json.post
  } catch {
    return null
  }
}

async function fetchPost(slug: string, attempt = 1): Promise<SubstackPost | null> {
  try {
    const response = await fetch(`${SITE}/api/v1/posts/${slug}`, {
      headers: { Accept: 'application/json' }
    })

    if (response.status === 429) {
      if (attempt > 6) throw new Error('rate limited')
      const waitMs = attempt * 5000
      console.log(`… rate limited on ${slug}, waiting ${waitMs / 1000}s`)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      return fetchPost(slug, attempt + 1)
    }

    if (!response.ok) {
      const html = await fetchText(`${SITE}/p/${slug}`)
      return parsePreloads(html)
    }

    const json = (await response.json()) as SubstackPost
    return json?.body_html ? json : null
  } catch (error) {
    if (attempt <= 2) {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      return fetchPost(slug, attempt + 1)
    }
    throw error
  }
}

async function getPostSlugs(): Promise<string[]> {
  const xml = await fetchText(`${SITE}/sitemap.xml`)
  const slugs = [...xml.matchAll(/<loc>https:\/\/www\.stoa\.news\/p\/([^<]+)<\/loc>/g)].map((m) => m[1])
  return [...new Set(slugs)]
}

function decodeImageUrl(url: string): string {
  try {
    const decoded = decodeURIComponent(url)
    const s3Match = decoded.match(/https:\/\/substack-post-media\.s3\.amazonaws\.com\/[^\s"']+/)
    if (s3Match) return s3Match[0]
  } catch {
    /* ignore */
  }
  return url
}

function getImageSrc(node: ReturnType<typeof parseHtml>): string | null {
  const img = node.querySelector('img')
  if (img?.getAttribute('src')) return decodeImageUrl(img.getAttribute('src')!)
  const link = node.querySelector('a.image-link')
  if (link?.getAttribute('href')) return decodeImageUrl(link.getAttribute('href')!)
  return null
}

function getCaption(node: ReturnType<typeof parseHtml>): string {
  const figcaption = node.querySelector('figcaption')
  return figcaption?.text.trim() || ''
}

async function downloadImage(url: string, slug: string, index: number): Promise<string | null> {
  try {
    const cleanUrl = decodeImageUrl(url)
    const extMatch = cleanUrl.match(/\.(png|jpe?g|webp|gif)(?:\?|$)/i)
    const ext = extMatch ? extMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg'
    const filename = `${slug}-${index}.${ext}`
    const localPath = join(ASSETS_DIR, filename)
    const publicPath = `./_assets/${filename}`

    if (!existsSync(localPath) || FORCE) {
      const response = await fetch(cleanUrl)
      if (!response.ok) return null
      const buffer = Buffer.from(await response.arrayBuffer())
      mkdirSync(ASSETS_DIR, { recursive: true })
      writeFileSync(localPath, buffer)
    }

    return publicPath
  } catch {
    return null
  }
}

function inlineToMarkdown(node: ReturnType<typeof parseHtml> | { text: string; tagName?: string }): string {
  if ('text' in node && !('childNodes' in node)) return node.text
  const el = node as ReturnType<typeof parseHtml>
  if (el.nodeType === 3) return el.text
  const tag = el.tagName?.toLowerCase()
  const children = el.childNodes.map((child) => inlineToMarkdown(child as ReturnType<typeof parseHtml>)).join('')

  switch (tag) {
    case 'strong':
    case 'b':
      return `**${children}**`
    case 'em':
    case 'i':
      return `*${children}*`
    case 'code':
      return `\`${children}\``
    case 'a': {
      const href = el.getAttribute('href')
      return href ? `[${children}](${href})` : children
    }
    case 'br':
      return '\n'
    default:
      return children
  }
}

async function htmlToMarkdown(html: string, slug: string, imageIndex = { value: 0 }): Promise<string> {
  const root = parseHtml(html)
  const blocks: string[] = []

  for (const node of root.childNodes) {
    if (node.nodeType !== 1) continue
    const el = node as ReturnType<typeof parseHtml>
    const tag = el.tagName?.toLowerCase()
    const className = el.getAttribute('class') || ''

    if (className.includes('subscription-widget-wrap') || className.includes('paywall')) continue
    if (el.text.includes('Obrigado por ler Stoa')) break

    if (tag === 'p') {
      const text = inlineToMarkdown(el).trim()
      if (text) blocks.push(text)
      continue
    }

    if (tag === 'h1' || tag === 'h2') {
      blocks.push(`## ${inlineToMarkdown(el).trim()}`)
      continue
    }

    if (tag === 'h3' || tag === 'h4') {
      blocks.push(`### ${inlineToMarkdown(el).trim()}`)
      continue
    }

    if (tag === 'blockquote') {
      const text = inlineToMarkdown(el).trim()
      if (text) blocks.push(text.split('\n').map((line) => `> ${line}`).join('\n'))
      continue
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = el.querySelectorAll('li').map((li, i) => {
        const prefix = tag === 'ol' ? `${i + 1}. ` : '- '
        return `${prefix}${inlineToMarkdown(li).trim()}`
      })
      blocks.push(items.join('\n'))
      continue
    }

    if (tag === 'hr') {
      blocks.push('---')
      continue
    }

    if (className.includes('captioned-image-container') || tag === 'figure') {
      const src = getImageSrc(el)
      if (src) {
        imageIndex.value += 1
        const local = await downloadImage(src, slug, imageIndex.value)
        const caption = getCaption(el)
        if (local) blocks.push(caption ? `![${caption}](${local})` : `![](${local})`)
      }
      continue
    }

    if (tag === 'div' && className.includes('captioned-image-container')) {
      continue
    }
  }

  return blocks.join('\n\n')
}

function cleanTitle(title: string): string {
  return title
    .replace(/^Stoa\s+\d+\s*\/\s*/i, '')
    .replace(/^Basculante\s+\d+\s*[–-]\s*/i, '')
    .trim()
}

function formatPubDate(isoDate: string): string {
  return isoDate.slice(0, 10)
}

function yamlEscape(value: string): string {
  return value.includes(':') || value.includes('"') ? `'${value.replace(/'/g, "''")}'` : value
}

async function importPost(slug: string): Promise<'created' | 'skipped' | 'failed'> {
  if (SKIP_SLUGS.has(slug)) {
    console.log(`↷ skipped (manual): ${slug}`)
    return 'skipped'
  }

  const filePath = join(POSTS_DIR, `${slug}.md`)
  if (existsSync(filePath) && !FORCE) {
    console.log(`↷ exists: ${slug}`)
    return 'skipped'
  }

  try {
    const post = await fetchPost(slug)
    if (!post) throw new Error('post data not found')

    const title = cleanTitle(post.title)
    const pubDate = formatPubDate(post.post_date)
    const body = await htmlToMarkdown(post.body_html, slug)
    const subtitle = post.subtitle?.trim()

    const parts = [
      '---',
      `title: ${yamlEscape(title)}`,
      `pubDate: '${pubDate}'`,
      '---',
      '',
      ...(subtitle ? [`### ${subtitle}`, ''] : []),
      body.trim()
    ]

    mkdirSync(POSTS_DIR, { recursive: true })
    writeFileSync(filePath, parts.join('\n') + '\n')
    console.log(`✅ ${slug}`)
    return 'created'
  } catch (error) {
    console.error(`❌ ${slug}:`, error instanceof Error ? error.message : error)
    return 'failed'
  }
}

async function main() {
  const slugs = await getPostSlugs()
  console.log(`Found ${slugs.length} posts on stoa.news`)

  let created = 0
  let skipped = 0
  let failed = 0

  for (const slug of slugs) {
    const result = await importPost(slug)
    if (result === 'created') created += 1
    else if (result === 'skipped') skipped += 1
    else failed += 1
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${failed} failed`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
