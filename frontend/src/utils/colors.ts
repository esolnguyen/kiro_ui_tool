const AGENT_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
]

export function getAgentColor(color?: string): string {
  if (color) return color
  return AGENT_COLORS[0]
}

export function randomAgentColor(): string {
  return AGENT_COLORS[Math.floor(Math.random() * AGENT_COLORS.length)]
}

export const AGENT_COLOR_OPTIONS = AGENT_COLORS
