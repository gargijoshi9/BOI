import { Link, useLocation } from 'react-router-dom'
import { useDrawer } from '../context/DrawerContext'

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/' },
  { label: 'Accounts', to: '/accounts' },
  { label: 'Network', to: '/network' },
] as const

function Sidebar() {
  const location = useLocation()
  const { toggleDrawer } = useDrawer()

  return (
    <aside className="flex h-full w-[220px] flex-col border-r border-border bg-background">
      <div className="border-b border-border px-6 py-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          MuleRadar
        </h1>
      </div>

      <nav className="flex flex-col">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              className={[
                'block w-full px-6 py-4 text-sm text-foreground',
                'border-l-2',
                isActive
                  ? 'border-l-border bg-white/5'
                  : 'border-l-transparent',
              ].join(' ')}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto p-4">
        <button
          type="button"
          onClick={toggleDrawer}
          className="block w-full border border-border bg-background px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-white hover:text-background"
        >
          ⚡ AI Assistant
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
