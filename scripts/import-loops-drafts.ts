/**
 * Import Loops draft campaigns as stoa.news posts.
 *
 * Usage:
 *   pnpm import-loops                     # import all Draft campaigns
 *   pnpm import-loops -- --dry-run        # preview without writing files
 *   pnpm import-loops -- --campaign ID    # import one campaign
 *   pnpm import-loops -- --force          # overwrite existing posts
 *
 * Requires LOOPS_API_KEY in .env
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { getEmailMessage, listCampaigns, validateApiKey } from './loops/client'
import { lmxToMarkdown } from './loops/lmx-to-markdown'

const POSTS_DIR = join('src/content/posts')
const FORCE = process.argv.includes('--force')
const DRY_RUN = process.argv.includes('--dry-run')
const campaignFlagIndex = process.argv.indexOf('--campaign')
const CAMPAIGN_ID = campaignFlagIndex === -1 ? undefined : process.argv[campaignFlagIndex + 1]

function loadEnv(): void {
  const envPath = join(process.cwd(), '.env')
  if (!existsSync(envPath)) return

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

function cleanTitle(subject: string): string {
  return subject
    .replace(/^Stoa\s+\d+\s*[–-]\s*/i, '')
    .replace(/^Basculante\s+\d+\s*[–-]\s*/i, '')
    .trim()
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function yamlEscape(value: string): string {
  return value.includes(':') || value.includes('"') ? `'${value.replace(/'/g, "''")}'` : value
}

function formatPubDate(isoDate: string): string {
  return isoDate.slice(0, 10)
}

async function importCampaign(campaignId: string): Promise<'created' | 'skipped' | 'failed'> {
  try {
    const campaigns = await listCampaigns()
    const campaign = campaigns.find((item) => item.id === campaignId)
    if (!campaign) throw new Error('campaign not found')

    const message = await getEmailMessage(campaign.emailMessageId)
    const title = cleanTitle(message.subject || campaign.name)
    const slug = slugify(title)
    const pubDate = formatPubDate(campaign.updatedAt || campaign.createdAt)
    const body = await lmxToMarkdown(message.lmx, slug)
    const filePath = join(POSTS_DIR, `${slug}.md`)

    if (existsSync(filePath) && !FORCE) {
      console.log(`↷ exists: ${campaign.name} → ${slug}.md`)
      return 'skipped'
    }

    const content = ['---', `title: ${yamlEscape(title)}`, `pubDate: '${pubDate}'`, '---', '', body, ''].join('\n')

    if (DRY_RUN) {
      console.log(`📝 dry-run: ${campaign.name} → ${filePath}`)
      console.log(content.slice(0, 500) + (content.length > 500 ? '…' : ''))
      return 'created'
    }

    writeFileSync(filePath, content)
    console.log(`✅ ${campaign.name} → ${slug}.md`)
    return 'created'
  } catch (error) {
    console.error(`❌ ${campaignId}:`, error instanceof Error ? error.message : error)
    return 'failed'
  }
}

async function main(): Promise<void> {
  loadEnv()

  const teamName = await validateApiKey()
  console.log(`Connected to Loops: ${teamName}`)

  const campaigns = CAMPAIGN_ID
    ? [{ id: CAMPAIGN_ID }]
    : (await listCampaigns('Draft')).map((campaign) => ({ id: campaign.id }))

  if (campaigns.length === 0) {
    console.log('No draft campaigns found.')
    return
  }

  let created = 0
  let skipped = 0
  let failed = 0

  for (const campaign of campaigns) {
    const result = await importCampaign(campaign.id)
    if (result === 'created') created += 1
    if (result === 'skipped') skipped += 1
    if (result === 'failed') failed += 1
  }

  console.log(`Done. created=${created} skipped=${skipped} failed=${failed}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
