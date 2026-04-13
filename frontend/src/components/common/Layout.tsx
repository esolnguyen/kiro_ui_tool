import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import { useAppStore } from '../../stores/appStore'
import WelcomeOnboarding from '../onboarding/WelcomeOnboarding'

export default function Layout() {
  const fetchAll = useAppStore((s) => s.fetchAll)

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return (
    <>
      <WelcomeOnboarding />

      <div
        style={{
          display: 'flex',
          height: '100vh',
          overflow: 'hidden',
          background: 'var(--surface-base)',
        }}
      >
        <Sidebar />
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            minWidth: 0,
          }}
        >
          <Outlet />
        </main>
      </div>
    </>
  )
}
