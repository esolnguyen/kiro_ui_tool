/**
 * Built-in slash commands shipped with the Kiro CLI.
 * These are read-only — users cannot edit or delete them.
 */
export interface BuiltinCommand {
    slug: string
    description: string
    group: BuiltinCommandGroup
    shortcut?: string
}

export type BuiltinCommandGroup =
    | 'Session'
    | 'Conversation'
    | 'Context & Code'
    | 'Agents & Tools'
    | 'Model'
    | 'Account'
    | 'Support'

export const BUILTIN_COMMAND_GROUPS: BuiltinCommandGroup[] = [
    'Session',
    'Conversation',
    'Context & Code',
    'Agents & Tools',
    'Model',
    'Account',
    'Support',
]

export const BUILTIN_COMMANDS: BuiltinCommand[] = [
    // Session
    { slug: 'quit', description: 'Exit the app', group: 'Session' },
    { slug: 'clear', description: 'Clear conversation history', group: 'Session' },
    { slug: 'compact', description: 'Summarize conversation to free up context space', group: 'Session' },
    { slug: 'help', description: 'Get help', group: 'Session' },

    // Conversation
    { slug: 'chat', description: 'Manage saved conversations', group: 'Conversation' },
    { slug: 'editor', description: 'Open $EDITOR to compose multi-line prompts', group: 'Conversation' },
    { slug: 'reply', description: 'Open $EDITOR with the most recent assistant message quoted', group: 'Conversation' },
    { slug: 'paste', description: 'Paste an image from clipboard', group: 'Conversation' },
    { slug: 'todos', description: 'View, manage, and resume to-do lists', group: 'Conversation' },

    // Context & Code
    { slug: 'context', description: 'Manage context files and view context window usage', group: 'Context & Code' },
    { slug: 'code', description: 'Code intelligence with LSP integration', group: 'Context & Code' },
    { slug: 'prompts', description: 'View and retrieve prompts', group: 'Context & Code' },
    { slug: 'hooks', description: 'View context hooks', group: 'Context & Code' },

    // Agents & Tools
    { slug: 'agent', description: 'Manage agents', group: 'Agents & Tools' },
    { slug: 'tools', description: 'View tools and permissions', group: 'Agents & Tools' },
    { slug: 'mcp', description: 'See loaded MCP servers', group: 'Agents & Tools' },
    { slug: 'plan', description: 'Switch to Plan agent', group: 'Agents & Tools', shortcut: 'Shift+Tab' },

    // Model
    { slug: 'model', description: 'Select a model for the session', group: 'Model' },
    { slug: 'experiment', description: 'Toggle experimental features', group: 'Model' },

    // Account
    { slug: 'usage', description: 'Show billing and credits info', group: 'Account' },

    // Support
    { slug: 'issue', description: 'Create a GitHub issue or feature request', group: 'Support' },
    { slug: 'logdump', description: 'Create a zip file with logs for support', group: 'Support' },
    { slug: 'changelog', description: 'View changelog', group: 'Support' },
]
