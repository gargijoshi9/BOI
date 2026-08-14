import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  {
    label: 'Dashboard', to: '/dashboard', icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  },
  {
    label: 'Risk Analysis', to: '/shap', icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20v-6" />
      </svg>
    )
  },
  {
    label: 'Network Graph', to: '/network', icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    )
  },
  {
    label: 'Accounts', to: '/accounts', icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  },
] as const

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out flex h-full w-[260px] flex-col bg-background-card/95 lg:bg-background-card/80 backdrop-blur-2xl border-r border-border/50`}
      >
      <div className="flex items-center justify-between px-6 h-16 border-b border-border/50">
        <Link
          to="/dashboard"
          className="flex items-center gap-3 text-decoration-none"
          onClick={onClose}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-teal-500">
          <svg className="h-5 w-5 text-navy-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
          <span className="font-bold text-heading-md text-foreground tracking-tight">
            MuleRadar
          </span>
        </Link>
        <button 
          className="lg:hidden p-2 -mr-2 text-foreground-muted hover:text-foreground"
          onClick={onClose}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex flex-1 flex-col px-4 py-6 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-body-sm font-medium transition-all duration-200 ${isActive
                  ? 'bg-accent/10 text-accent border border-accent/20 shadow-glow-teal'
                  : 'text-foreground-muted hover:bg-background-card hover:text-foreground hover:border-border/50'
                }`}
            >
              <span className="flex-shrink-0" aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}

        <div className="mt-auto pt-6 border-t border-border/50">
          <Link
            to="/"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-body-sm font-medium text-foreground-muted hover:bg-background-card hover:text-foreground hover:border-border/50 transition-all duration-200 border"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            Back to Platform
          </Link>
        </div>
      </nav>
    </aside>
    </>
  )
}

export default Sidebar