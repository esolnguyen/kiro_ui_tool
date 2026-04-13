import type { Agent } from '../types'
import { createCrudApi } from './crud'

export type AgentCreate = Omit<Agent, 'slug'>

export const agentsApi = createCrudApi<Agent, AgentCreate>('/agents')
