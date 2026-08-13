import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Use Cases', href: '#use-cases' },
  { label: 'Resources', href: '#resources' },
  { label: 'Company', href: '#company' },
] as const

function Navbar() {
  const location = useLocation()
  const isDashboard = location.pathname !== '/'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border/50">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 text-decoration-none"
          aria-label="MuleRadar Home"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-teal-500">
            <svg className="h-5 w-5 text-navy-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-heading-lg text-foreground tracking-tight">
            MuleRadar
          </span>
        </Link>

        {!isDashboard && (
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="px-4 py-2 text-body-sm font-medium text-foreground-muted transition-colors duration-200 hover:text-foreground rounded-lg"
              >
                {item.label}
              </a>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          {isDashboard && (
            <Link
              to="/"
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-body-sm font-medium text-foreground-muted transition-colors duration-200 hover:text-foreground rounded-lg"
            >
              Back to Home
            </Link>
          )}
          <Link
            to={isDashboard ? '/' : '/dashboard'}
            className={isDashboard ? 'btn-secondary hidden sm:flex' : 'btn-primary'}
          >
            {isDashboard ? 'View Platform' : 'Launch Console'}
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar