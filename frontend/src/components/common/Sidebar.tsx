import { NavLink, useLocation } from 'react-router-dom'
import {
  Bot,
  Terminal,
  Sparkles,
  Zap,
  Server,
  Settings,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ListTodo,
} from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  count?: number
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { agents, commands, skills } = useAppStore()
  const location = useLocation()
  const navItems: NavItem[] = [
    { to: '/workplace', label: 'Workplace', icon: <ClipboardList size={16} /> },
    {
      to: '/agents',
      label: 'Agents',
      icon: <Bot size={16} />,
      count: agents.length || undefined,
    },
    {
      to: '/commands',
      label: 'Commands',
      icon: <Terminal size={16} />,
      count: commands.length || undefined,
    },
    {
      to: '/skills',
      label: 'Skills',
      icon: <Sparkles size={16} />,
      count: skills.length || undefined,
    },
    { to: '/pipelines', label: 'Pipelines', icon: <Zap size={16} /> },
    { to: '/todos', label: 'TODOs', icon: <ListTodo size={16} /> },
    { to: '/mcp', label: 'MCP', icon: <Server size={16} /> },
    { to: '/settings', label: 'Settings', icon: <Settings size={16} /> },
  ]

  return (
    <aside
      style={{
        width: collapsed ? 56 : 220,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Logo / Brand */}
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '0 12px' : '0 16px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          justifyContent: collapsed ? 'center' : 'space-between',
        }}
      >
        {!collapsed && (
          <NavLink
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
            }}
          >
            <img
              src="/icon.svg"
              alt="Kiro"
              style={{ width: 26, height: 26, flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              Kiro
            </span>
          </NavLink>
        )}
        {collapsed && (
          <NavLink to="/" style={{ display: 'flex', textDecoration: 'none' }}>
            <img
              src="/icon.svg"
              alt="Kiro"
              style={{ width: 26, height: 26 }}
            />
          </NavLink>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="btn-ghost btn"
            style={{ padding: '4px 6px', borderRadius: 6 }}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: collapsed ? '9px 0' : '9px 14px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              margin: '1px 6px',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: isActive ? 'var(--accent-muted)' : 'transparent',
              transition: 'all 0.15s ease',
            })}
            className="focus-ring hover-bg"
          >
            <span style={{ flexShrink: 0 }}>{item.icon}</span>
            {!collapsed && (
              <>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.count !== undefined && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono, monospace)',
                      color: 'var(--text-tertiary)',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 999,
                      padding: '1px 6px',
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div
          style={{
            padding: '8px 0',
            display: 'flex',
            justifyContent: 'center',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <button
            onClick={() => setCollapsed(false)}
            className="btn-ghost btn"
            style={{ padding: '6px 8px', borderRadius: 6 }}
            aria-label="Expand sidebar"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Kiro dir indicator */}
      {!collapsed && (
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 11,
            color: 'var(--text-tertiary)',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          ~/.kiro
        </div>
      )}
    </aside>
  )
}
