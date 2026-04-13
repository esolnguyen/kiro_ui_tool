import type { Skill } from '../types'
import { createCrudApi } from './crud'

export type SkillCreate = Omit<Skill, 'slug'>

export const skillsApi = createCrudApi<Skill, SkillCreate>('/skills')
