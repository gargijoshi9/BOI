import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'

const NAV_ITEMS = [
  { label: 'The Problem', href: '#problem' },
  { label: 'Our Solution', href: '#solution' },
  { label: 'Why Us', href: '#why-us' },
] as const

function Navbar() {
  const location = useLocation()
  const isDashboard = location.pathname !== '/'
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A1526]/80 backdrop-blur-md border-b border-white/5">
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
            className={`hidden sm:flex ${isDashboard ? 'btn-secondary' : 'btn-primary'}`}
          >
            {isDashboard ? 'View Platform' : 'Launch Console'}
          </Link>

          {!isDashboard && (
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 -mr-2 text-foreground-muted hover:text-foreground"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && !isDashboard && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-[#0A1526]/95 backdrop-blur-xl border-b border-white/5 p-4 flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setIsMenuOpen(false)}
              className="px-4 py-3 text-body-md font-medium text-foreground hover:bg-white/5 rounded-lg"
            >
              {item.label}
            </a>
          ))}
          <div className="h-px bg-white/10 my-2" />
          <Link
            to="/dashboard"
            onClick={() => setIsMenuOpen(false)}
            className="btn-primary w-full justify-center"
          >
            Launch Console
          </Link>
        </div>
      )}
    </nav>
  )
}

export default Navbar