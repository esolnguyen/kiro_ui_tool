import { create } from 'zustand'
import type { Agent, Command, Skill, Pipeline, Settings } from '../types'
import { agentsApi } from '../api/agents'
import { commandsApi } from '../api/commands'
import { skillsApi } from '../api/skills'
import { pipelinesApi } from '../api/pipelines'
import { settingsApi } from '../api/settings'

interface AppState {
  agents: Agent[]
  commands: Command[]
  skills: Skill[]
  pipelines: Pipeline[]
  settings: Settings | null
  loading: boolean
  error: string | null

  fetchAgents: () => Promise<void>
  fetchCommands: () => Promise<void>
  fetchSkills: () => Promise<void>
  fetchPipelines: () => Promise<void>
  fetchSettings: () => Promise<void>
  fetchAll: () => Promise<void>

  setAgents: (agents: Agent[]) => void
  setCommands: (commands: Command[]) => void
  setSkills: (skills: Skill[]) => void
  setPipelines: (pipelines: Pipeline[]) => void
  setSettings: (settings: Settings) => void
  setError: (error: string | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  agents: [],
  commands: [],
  skills: [],
  pipelines: [],
  settings: null,
  loading: false,
  error: null,

  fetchAgents: async () => {
    try {
      const agents = await agentsApi.list()
      set({ agents })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to fetch agents' })
    }
  },

  fetchCommands: async () => {
    try {
      const commands = await commandsApi.list()
      set({ commands })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to fetch commands' })
    }
  },

  fetchSkills: async () => {
    try {
      const skills = await skillsApi.list()
      set({ skills })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to fetch skills' })
    }
  },

  fetchPipelines: async () => {
    try {
      const pipelines = await pipelinesApi.list()
      set({ pipelines })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to fetch pipelines' })
    }
  },

  fetchSettings: async () => {
    try {
      const settings = await settingsApi.get()
      set({ settings })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to fetch settings' })
    }
  },

  fetchAll: async () => {
    set({ loading: true, error: null })
    await Promise.all([
      get().fetchAgents(),
      get().fetchCommands(),
      get().fetchSkills(),
      get().fetchPipelines(),
      get().fetchSettings(),
    ])
    set({ loading: false })
  },

  setAgents: (agents) => set({ agents }),
  setCommands: (commands) => set({ commands }),
  setSkills: (skills) => set({ skills }),
  setPipelines: (pipelines) => set({ pipelines }),
  setSettings: (settings) => set({ settings }),
  setError: (error) => set({ error }),
}))
