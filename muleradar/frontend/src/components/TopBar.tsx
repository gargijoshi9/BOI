import { useEffect, useState } from 'react'
import { fetchHealth, HealthResponse } from '../api/client'

function TopBar() {
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
    <header className="flex h-16 w-full items-center justify-between px-6 glass-strong border-b border-border/50">
      <div className="flex items-center gap-4">
        <h2 className="text-heading-sm font-semibold text-foreground">
          Fraud Operations Console
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <span
<<<<<<< Updated upstream
          className={
            'inline-block h-2 w-2 rounded-full live-dot ' +
            (isConnecting ? '' : '')
          }
          style={{ backgroundColor: accentColor }}
        />
        {isHealthy ? (
          <>
            <span>LIVE</span>
            <span style={{ color: '#0da57aff' }}>— {health?.mode}</span>
          </>
        ) : (
          <span style={{ color: '#cbd5e1' }}>Connecting...</span>
        )}
      </span>
=======
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

        <div className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-body-sm font-medium text-foreground-muted bg-background-card border border-border/50 hover:bg-background-cardHover hover:text-foreground transition-all duration-200 cursor-pointer">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>UTC</span>
        </div>
      </div>
>>>>>>> Stashed changes
    </header>
  )
}

export default TopBar