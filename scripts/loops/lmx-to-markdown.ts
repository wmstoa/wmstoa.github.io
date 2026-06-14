import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'

const ASSETS_DIR = join('src/content/posts/_assets')

interface LmxBlock {
  tag: string
  attrs: string
  inner: string
}

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;amp;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function getAttr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`))
  return match?.[1]
}

function inlineLmxToMarkdown(source: string): string {
  let text = source
  text = text.replace(/<Link href="([^"]+)"><Underline>([\s\S]*?)<\/Underline><\/Link>/g, '[$2]($1)')
  text = text.replace(/<Strong>([\s\S]*?)<\/Strong>/g, '**$1**')
  text = text.replace(/<Em[^>]*>([\s\S]*?)<\/Em>/g, '*$1*')
  text = text.replace(/<Text[^>]*>([\s\S]*?)<\/Text>/g, '$1')
  text = text.replace(/<Br\s*\/?>/g, '\n')
  text = text.replace(/<[^>]+>/g, '')
  return decodeEntities(text)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function* iterateBlocks(lmx: string): Generator<LmxBlock> {
  const pattern = /<(Style|Component|Paragraph|Image|Divider|H1)([^>]*?)(\s*\/>|>([\s\S]*?)<\/\1>)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(lmx))) {
    yield {
      tag: match[1],
      attrs: match[2],
      inner: match[4] ?? ''
    }
  }
}

function isHeaderComponent(block: LmxBlock): boolean {
  if (block.tag !== 'Component') return false
  return /componentId="cmp2ybg0v08bg0i5mztoxlxgv"|componentId="cmp2zn65b00mf0iyfovkcjzaa"/.test(block.attrs)
}

function normalizeForSkip(text: string): string {
  return text.replace(/\*/g, '').replace(/_/g, '').replace(/\s+/g, ' ').trim()
}

function shouldSkipParagraph(text: string): boolean {
  const normalized = normalizeForSkip(text)
  if (!normalized) return true
  if (/^Edição\s+#\d+$/i.test(normalized)) return true
  if (normalized === 'stoa.news') return true
  if (/^por Willian Matiola$/i.test(normalized)) return true
  if (/^Você está recebendo esse email/i.test(normalized)) return true
  return false
}

function shouldSkipImage(attrs: string): boolean {
  const alt = getAttr(attrs, 'alt') ?? ''
  const width = getAttr(attrs, 'width') ?? ''
  if (alt === 'Stoa News') return true
  if (width === '24' || width === '40') return true
  return false
}

function isFooterStart(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return (
    /^Você concorda, discorda ou tem algo para adicionar/i.test(normalized) ||
    normalized === 'Meus projetos' ||
    normalized === 'Minhas redes' ||
    normalized === 'Meu livro'
  )
}

function isQuoteParagraph(block: LmxBlock): boolean {
  if (block.tag !== 'Paragraph') return false
  if (!/align="center"/.test(block.attrs)) return false
  const text = inlineLmxToMarkdown(block.inner)
  return text.startsWith('"') || text.includes('"')
}

async function downloadImage(url: string, slug: string, index: number): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    const ext =
      extname(new URL(url).pathname).replace('.', '') ||
      (contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg')
    const filename = `${slug}-${index}.${ext}`
    const localPath = join(ASSETS_DIR, filename)
    const assetRef = `./_assets/${filename}`

    if (!existsSync(ASSETS_DIR)) mkdirSync(ASSETS_DIR, { recursive: true })

    const buffer = Buffer.from(await response.arrayBuffer())
    writeFileSync(localPath, buffer)
    return assetRef
  } catch {
    return null
  }
}

export async function lmxToMarkdown(lmx: string, slug: string): Promise<string> {
  const blocks = [...iterateBlocks(lmx)]
  const markdownBlocks: string[] = []
  const imageIndex = { value: 0 }
  let stop = false
  let pendingQuote = false

  for (const block of blocks) {
    if (stop) break

    if (block.tag === 'Style' || block.tag === 'H1' || isHeaderComponent(block)) continue
    if (block.tag === 'Component') continue

    if (block.tag === 'Divider') {
      pendingQuote = true
      continue
    }

    if (pendingQuote && isQuoteParagraph(block)) {
      const quote = inlineLmxToMarkdown(block.inner)
        .replace(/\*"/g, '"')
        .replace(/"\*/g, '"')
        .replace(/^\*|\*$/g, '')
      markdownBlocks.push(
        quote
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n')
      )
      pendingQuote = false
      continue
    }

    pendingQuote = false

    if (block.tag === 'Paragraph') {
      const text = inlineLmxToMarkdown(block.inner)
      if (shouldSkipParagraph(text)) continue
      if (isFooterStart(text)) {
        stop = true
        continue
      }
      markdownBlocks.push(text)
      continue
    }

    if (block.tag === 'Image') {
      if (shouldSkipImage(block.attrs)) continue
      const src = getAttr(block.attrs, 'src')
      if (!src) continue

      imageIndex.value += 1
      const local = await downloadImage(src, slug, imageIndex.value)
      const alt = decodeEntities(getAttr(block.attrs, 'alt') ?? '')
      if (local) markdownBlocks.push(alt ? `![${alt}](${local})` : `![](${local})`)
    }
  }

  return markdownBlocks.join('\n\n').trim()
}
