import { RiskLevel } from '../api/client'

interface RiskScoreWidgetProps {
  riskScore?: number
  riskLevel?: RiskLevel
  isSimulated?: boolean
}

const RISK_COLORS: Record<RiskLevel, string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
}

const RISK_BADGE_CLASS: Record<RiskLevel, string> = {
  Critical: 'badge-critical',
  High: 'badge-high',
  Medium: 'badge-medium',
  Low: 'badge-low',
}

function WidgetShell({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`card card-hover ${className}`}>
      {children}
    </div>
  )
}

function WidgetTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="stat-label">
      {children}
    </h3>
  )
}

function RiskScoreWidget({ riskScore, riskLevel, isSimulated }: RiskScoreWidgetProps) {
  const score = riskScore ?? 910
  const level: RiskLevel = riskLevel ?? 'Critical'
  const badgeClass = RISK_BADGE_CLASS[level]

  return (
    <WidgetShell className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative flex flex-col h-full">
        <div className="flex flex-row items-center justify-between">
          <WidgetTitle>Risk Score</WidgetTitle>
          {isSimulated && (
            <span className="badge badge-high" title="Simulated result - not from live model">
              Simulated
            </span>
          )}
        </div>
        <div className="mt-6 flex flex-row items-baseline justify-center gap-3">
          <span className="font-mono font-bold text-5xl md:text-6xl lg:text-7xl text-foreground tracking-tight leading-none">
            {score.toLocaleString()}
          </span>
          <span className="text-body-md text-foreground-muted self-end mb-2">/ 1000</span>
        </div>
        <div className="mt-6 h-px w-full bg-border" />
        <div className="mt-4 flex flex-row items-center justify-between">
          <WidgetTitle>Risk Level</WidgetTitle>
          <span className={badgeClass}>{level}</span>
        </div>
      </div>
    </WidgetShell>
  )
}

export default RiskScoreWidget
export { RISK_COLORS, WidgetShell, WidgetTitle }