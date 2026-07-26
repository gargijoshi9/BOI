import { RiskLevel } from '../api/client'

interface RiskScoreWidgetProps {
  riskScore?: number
  riskLevel?: RiskLevel
}

const RISK_COLORS: Record<RiskLevel, string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
}

function WidgetShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col border border-border bg-background p-7">
      {children}
    </div>
  )
}

function WidgetTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-widest text-foreground-muted">
      {children}
    </h3>
  )
}

function RiskScoreWidget({ riskScore, riskLevel }: RiskScoreWidgetProps) {
  const score = riskScore ?? 91
  const level: RiskLevel = riskLevel ?? 'Critical'
  const color = RISK_COLORS[level]

  return (
    <WidgetShell>
      <WidgetTitle>Risk Score</WidgetTitle>
      <div className="mt-4 flex flex-row items-baseline justify-center gap-2">
        <span className="text-7xl font-bold leading-none text-foreground">
          {score}
        </span>
        <span className="text-lg text-foreground-muted">/1000</span>
      </div>
      <div className="mt-6 h-[2px] w-full bg-foreground" />
      <div className="mt-4 flex flex-row items-center justify-between">
        <p className="text-xs text-foreground-muted">Risk Level</p>
        <span
          className="inline-flex items-center px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-foreground"
          style={{ backgroundColor: color, color: '#000000' }}
        >
          {level}
        </span>
      </div>
    </WidgetShell>
  )
}

export default RiskScoreWidget
export { RISK_COLORS, WidgetShell, WidgetTitle }
