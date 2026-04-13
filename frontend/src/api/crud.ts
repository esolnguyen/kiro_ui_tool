import client from './client'

/**
 * Creates a standard CRUD API object for a given resource path.
 *
 * Usage:
 *   const agentsApi = createCrudApi<Agent, AgentCreate>('/agents')
 *   const workflowsApi = createCrudApi<Workflow, WorkflowCreate>('/workflows', 'id')
 */
export function createCrudApi<
  TResponse,
  TCreate = Omit<TResponse, 'slug'>,
>(basePath: string, idField: 'slug' | 'id' = 'slug') {
  return {
    list: () => client.get<TResponse[]>(basePath).then((r) => r.data),

    get: (id: string) =>
      client.get<TResponse>(`${basePath}/${id}`).then((r) => r.data),

    create: (data: TCreate) =>
      client.post<TResponse>(basePath, data).then((r) => r.data),

    update: (id: string, data: TCreate) =>
      client.put<TResponse>(`${basePath}/${id}`, data).then((r) => r.data),

    delete: (id: string) => client.delete(`${basePath}/${id}`),
  }
}
