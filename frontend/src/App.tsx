import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/common/Layout'
import DashboardPage from './pages/DashboardPage'
import AgentsPage, { AgentDetailPage } from './pages/AgentsPage'
import CommandsPage, { CommandDetailPage } from './pages/CommandsPage'
import SkillsPage, { SkillDetailPage } from './pages/SkillsPage'
import PipelinesPage from './pages/PipelinesPage'
import { TodosPage } from './pages/TodosPage'
import WorkplacePage from './pages/WorkplacePage'
import McpPage from './pages/McpPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/new" element={<AgentDetailPage />} />
          <Route path="/agents/:slug" element={<AgentDetailPage />} />
          <Route path="/commands" element={<CommandsPage />} />
          <Route path="/commands/new" element={<CommandDetailPage />} />
          <Route path="/commands/:slug" element={<CommandDetailPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/skills/new" element={<SkillDetailPage />} />
          <Route path="/skills/:slug" element={<SkillDetailPage />} />
          <Route path="/workplace" element={<WorkplacePage />} />
          <Route path="/pipelines" element={<PipelinesPage />} />
          <Route path="/todos" element={<TodosPage />} />
          <Route path="/mcp" element={<McpPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
