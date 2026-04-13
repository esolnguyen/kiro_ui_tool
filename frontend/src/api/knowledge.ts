import client from './client'

export interface KnowledgeEntry {
  id: string
  name: string
  path: string
  indexType: string
  fileCount: number
  includePatterns: string[]
  excludePatterns: string[]
}

export interface KnowledgeAddRequest {
  name: string
  path: string
  indexType: string
  includePatterns: string[]
  excludePatterns: string[]
}

export const knowledgeApi = {
  list: (agentSlug: string) =>
    client.get<KnowledgeEntry[]>(`/agents/${agentSlug}/knowledge`).then((r) => r.data),

  add: (agentSlug: string, data: KnowledgeAddRequest) =>
    client.post(`/agents/${agentSlug}/knowledge`, data).then((r) => r.data),

  remove: (agentSlug: string, entryName: string) =>
    client.delete(`/agents/${agentSlug}/knowledge/${encodeURIComponent(entryName)}`).then((r) => r.data),

  update: (agentSlug: string, entryName: string) =>
    client.post(`/agents/${agentSlug}/knowledge/${encodeURIComponent(entryName)}/update`).then((r) => r.data),

  clear: (agentSlug: string) =>
    client.delete(`/agents/${agentSlug}/knowledge`).then((r) => r.data),
}
