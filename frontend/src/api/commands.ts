import type { Command } from '../types'
import { createCrudApi } from './crud'

export type CommandCreate = Omit<Command, 'slug'>

export const commandsApi = createCrudApi<Command, CommandCreate>('/commands')
