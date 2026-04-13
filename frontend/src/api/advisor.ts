import client from './client'

export const advisorApi = {
  createSession: (executorSessionId: string, advisorModel = 'opus', advisorAgent?: string) =>
    client.post<{ id: string; advisorModel: string }>('/advisor/sessions', {
      executorSessionId,
      advisorModel,
      advisorAgent,
    }).then((r) => r.data),

  listSessions: () =>
    client.get<Array<{ id: string; executorSessionId: string; advisorModel: string; historyCount: number }>>('/advisor/sessions').then((r) => r.data),

  ask: (sessionId: string, context: string, question: string) =>
    client.post<{ advice: string }>(`/advisor/sessions/${sessionId}/ask`, { context, question }).then((r) => r.data),

  getHistory: (sessionId: string) =>
    client.get<Array<{ timestamp: string; question: string; advice: string }>>(`/advisor/sessions/${sessionId}/history`).then((r) => r.data),

  deleteSession: (sessionId: string) =>
    client.delete(`/advisor/sessions/${sessionId}`),
}
