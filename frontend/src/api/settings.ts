import client from './client'
import type { Settings } from '../types'

export const settingsApi = {
  get: () => client.get<Settings>('/settings').then((r) => r.data),
  update: (data: Settings) => client.put<Settings>('/settings', data).then((r) => r.data),
}
