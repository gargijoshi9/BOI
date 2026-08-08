import { Link, useLocation } from 'react-router-dom'
import { useDrawer } from '../context/DrawerContext'

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Accounts', to: '/accounts' },
  { label: 'Network', to: '/network' },
] as const

function Sidebar() {
  const location = useLocation()
  const { toggleDrawer } = useDrawer()

  return (
    <aside
      className="flex h-full w-[220px] flex-col"
      style={{
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div
        className="px-6 py-6"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <h1 className="flex flex-row items-center gap-2 text-[20px] font-extrabold tracking-tight text-[#f8fafc]">
          <span style={{ color: '#22d3ee' }}>•</span>
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
              className="block w-full border-l-2 px-6 py-4 text-sm"
              style={{
                color: isActive ? '#22d3ee' : '#cbd5e1',
                background: isActive
                  ? 'rgba(34, 211, 238, 0.06)'
                  : 'transparent',
                borderLeftColor: isActive ? '#22d3ee' : 'transparent',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (isActive) return
                e.currentTarget.style.color = '#f8fafc'
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
              }}
              onMouseLeave={(e) => {
                if (isActive) return
                e.currentTarget.style.color = '#cbd5e1'
                e.currentTarget.style.background = 'transparent'
              }}
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
          className="block w-full px-4 py-3 text-left text-sm font-medium"
          style={{
            background:
              'linear-gradient(135deg, rgba(34, 211, 238, 0.1), rgba(168, 85, 247, 0.1))',
            border: '1px solid rgba(34, 211, 238, 0.3)',
            color: '#22d3ee',
            transition: 'all 200ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.6)'
            e.currentTarget.style.boxShadow =
              '0 0 16px rgba(34, 211, 238, 0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.3)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          ⚡ AI Assistant
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
