import client from './client'
import type { McpServer, McpToolsResponse } from '../types'

export const mcpApi = {
  list: () => client.get<McpServer[]>('/mcp').then((r) => r.data),
  add: (data: McpServer) => client.post<McpServer>('/mcp', data).then((r) => r.data),
  update: (name: string, data: McpServer) =>
    client.put<McpServer>(`/mcp/${name}`, data).then((r) => r.data),
  delete: (name: string) => client.delete(`/mcp/${name}`),
  listTools: (name: string) =>
    client.get<McpToolsResponse>(`/mcp/${encodeURIComponent(name)}/tools`).then((r) => r.data),
}
