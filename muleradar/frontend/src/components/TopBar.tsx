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
  const isConnecting = health === null

  // LIVE: cyan tones. Connecting/error: red tones.
  const accentColor = isHealthy ? '#22d3ee' : '#ef4444'
  const accentBg = isHealthy
    ? 'rgba(34, 211, 238, 0.08)'
    : 'rgba(239, 68, 68, 0.08)'
  const accentBorder = isHealthy
    ? 'rgba(34, 211, 238, 0.4)'
    : 'rgba(239, 68, 68, 0.4)'

  return (
    <header
      className="flex h-16 w-full items-center justify-between px-6"
      style={{
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <h2
        className="text-base font-semibold"
        style={{ color: '#f8fafc' }}
      >
        Fraud Operations Console
      </h2>

      <span
        className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium"
        style={{
          background: accentBg,
          border: `1px solid ${accentBorder}`,
          color: accentColor,
          borderRadius: '9999px',
        }}
      >
        <span
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
    </header>
  )
}

export default TopBar
