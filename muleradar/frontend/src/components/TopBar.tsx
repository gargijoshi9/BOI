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
        // leave health null → UI shows "Connecting..."
      })
    return () => {
      cancelled = true
    }
  }, [])

  const isHealthy = health?.status === 'healthy'

  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-border px-6">
      <h2 className="text-base font-medium text-foreground">
        Fraud Operations Console
      </h2>

      <span className="inline-flex items-center gap-2 border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
        <span
          className={
            'inline-block h-2 w-2 rounded-full ' +
            (isHealthy ? 'bg-[#22c55e]' : 'bg-foreground-muted')
          }
        />
        {isHealthy ? (
          <>
            <span>● LIVE</span>
            <span className="text-foreground-muted">— {health?.mode}</span>
          </>
        ) : (
          <span className="text-foreground-muted">Connecting...</span>
        )}
      </span>
    </header>
  )
}

export default TopBar
