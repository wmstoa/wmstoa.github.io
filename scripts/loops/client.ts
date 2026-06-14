const API_BASE = 'https://app.loops.so/api/v1'

export interface LoopsCampaign {
  id: string
  name: string
  status: string
  createdAt: string
  updatedAt: string
  emailMessageId: string
  subject?: string
}

export interface LoopsEmailMessage {
  id: string
  campaignId: string | null
  subject: string
  previewText: string
  lmx: string
  updatedAt: string
}

interface PaginatedCampaigns {
  pagination: {
    totalResults: number
    nextCursor: string | null
  }
  data: LoopsCampaign[]
}

function getApiKey(): string {
  const key = process.env.LOOPS_API_KEY?.trim()
  if (!key) {
    throw new Error('Missing LOOPS_API_KEY. Add it to .env or export it in your shell.')
  }
  return key
}

async function loopsFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${getApiKey()}`
    }
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Loops API ${response.status} for ${path}: ${body}`)
  }

  return response.json() as Promise<T>
}

export async function validateApiKey(): Promise<string> {
  const result = await loopsFetch<{ success: boolean; teamName: string }>('/api-key')
  if (!result.success) throw new Error('Invalid Loops API key')
  return result.teamName
}

export async function listCampaigns(status?: string): Promise<LoopsCampaign[]> {
  const campaigns: LoopsCampaign[] = []
  let cursor: string | undefined

  do {
    const params = new URLSearchParams({ perPage: '50' })
    if (cursor) params.set('cursor', cursor)
    const page = await loopsFetch<PaginatedCampaigns>(`/campaigns?${params}`)
    campaigns.push(...page.data)
    cursor = page.pagination.nextCursor ?? undefined
  } while (cursor)

  return status ? campaigns.filter((campaign) => campaign.status === status) : campaigns
}

export async function getEmailMessage(id: string): Promise<LoopsEmailMessage> {
  return loopsFetch<LoopsEmailMessage>(`/email-messages/${id}`)
}
