import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'SHAP', to: '/shap' },
  { label: 'Network', to: '/network' },
  { label: 'Accounts', to: '/accounts' },
] as const

function Sidebar() {
  const location = useLocation()

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
      <Link
        to="/"
        className="px-6 py-6 block"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)', textDecoration: 'none' }}
      >
        <h1 className="flex flex-row items-center gap-2 text-[20px] font-extrabold tracking-tight text-[#f8fafc]">
          <span style={{ color: '#22d3ee' }}>•</span>
          MuleRadar
        </h1>
      </Link>

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

      <div className="mt-auto p-4 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
        <p className="text-xs text-center" style={{ color: '#94a3b8' }}>
          v1.0.0
        </p>
      </div>
    </aside>
  )
}

export default Sidebar
