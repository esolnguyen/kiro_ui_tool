import client from './client'

export const generateApi = {
  getPrompt: (entityType: string, description: string) =>
    client.post<{ prompt: string; tmpFile: string }>('/generate/prompt', { entityType, description }).then((r) => r.data),
}
