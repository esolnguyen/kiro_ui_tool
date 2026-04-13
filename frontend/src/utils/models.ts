import type { ModelType } from '../types'

export const MODEL = {
  OPUS: 'opus' as const,
  SONNET: 'sonnet' as const,
  HAIKU: 'haiku' as const,
}

export const MODEL_IDS: ModelType[] = ['opus', 'sonnet', 'haiku']
export const DEFAULT_MODEL: ModelType = MODEL.SONNET

export interface ModelMeta {
  label: string
  tagline: string
  description: string
  color: string
  badgeBg: string
  badgeText: string
  contextWindow: number
}

export const MODEL_META: Record<ModelType, ModelMeta> = {
  opus: {
    label: 'Opus',
    tagline: 'Most capable',
    description: 'Best for complex reasoning and nuanced tasks',
    color: '#8b5cf6',
    badgeBg: 'rgba(139, 92, 246, 0.12)',
    badgeText: '#8b5cf6',
    contextWindow: 200000,
  },
  sonnet: {
    label: 'Sonnet',
    tagline: 'Balanced',
    description: 'Great balance of speed and intelligence',
    color: '#6366f1',
    badgeBg: 'rgba(99, 102, 241, 0.12)',
    badgeText: '#6366f1',
    contextWindow: 200000,
  },
  haiku: {
    label: 'Haiku',
    tagline: 'Fast',
    description: 'Fastest and most compact model',
    color: '#06b6d4',
    badgeBg: 'rgba(6, 182, 212, 0.12)',
    badgeText: '#06b6d4',
    contextWindow: 200000,
  },
}

export const MODEL_OPTIONS = [
  { value: '', label: 'Default' },
  ...MODEL_IDS.map((id) => ({
    value: id,
    label: MODEL_META[id].label,
    tagline: MODEL_META[id].tagline,
  })),
]

export function getModelLabel(model: string): string {
  return MODEL_META[model as ModelType]?.label ?? model
}

export function getModelColor(model: string): string {
  return MODEL_META[model as ModelType]?.color ?? '#6b7280'
}

export function getModelTagline(model: string): string {
  return MODEL_META[model as ModelType]?.tagline ?? ''
}
