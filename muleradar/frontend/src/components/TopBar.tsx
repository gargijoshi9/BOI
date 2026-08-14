import { useEffect, useState } from 'react'
import { fetchHealth, HealthResponse } from '../api/client'

interface TopBarProps {
  onMenuClick?: () => void
}

function TopBar({ onMenuClick }: TopBarProps) {
  const [health, setHealth] = useState<HealthResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchHealth()
      .then((data) => {
        if (cancelled) return
        setHealth(data)
      })
      .catch(() => {
        if (cancelled) return
      })
    return () => {
      cancelled = true
    }
  }, [])

  const isHealthy = health?.status === 'healthy'
  const isConnecting = health === null

  return (
    <header className="flex h-16 w-full items-center justify-between px-4 sm:px-6 glass-strong border-b border-border/50">
      <div className="flex items-center gap-3 sm:gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-foreground-muted hover:text-foreground hover:bg-white/5 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h2 className="text-heading-sm font-semibold text-foreground hidden sm:block">
          Fraud Operations Console
        </h2>
        <h2 className="text-body-md font-bold text-foreground sm:hidden tracking-tight flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-teal-500">
            <svg className="h-4 w-4 text-navy-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          MuleRadar
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <span
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-caption font-medium transition-all duration-200"
          style={{
            background: isHealthy ? 'rgba(0, 212, 170, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderColor: isHealthy ? 'rgba(0, 212, 170, 0.3)' : 'rgba(239, 68, 68, 0.3)',
            color: isHealthy ? '#00d4aa' : '#ef4444',
          }}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${isHealthy || isConnecting ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: isHealthy ? '#00d4aa' : '#ef4444' }}
          />
          {isHealthy ? (
            <>
              <span>LIVE</span>
              <span className="text-foreground-muted">— {health?.mode}</span>
            </>
          ) : (
            <span className="text-foreground-muted">Connecting...</span>
          )}
        </span>
      </div>
    </header>
  )
}

export default TopBar