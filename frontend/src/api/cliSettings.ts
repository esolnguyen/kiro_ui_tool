import client from './client'

export interface CliSetting {
  key: string
  description: string
  type: string
  value: string | null
  scope: string | null
}

export const cliSettingsApi = {
  list: () => client.get<CliSetting[]>('/cli-settings').then((r) => r.data),
  set: (key: string, value: string, workspace = false) =>
    client.put<CliSetting>('/cli-settings', { key, value, workspace }).then((r) => r.data),
  delete: (key: string, workspace = false) =>
    client.delete('/cli-settings', { data: { key, workspace } }),
}
