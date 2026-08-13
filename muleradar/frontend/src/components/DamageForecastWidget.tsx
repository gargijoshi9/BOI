import { DamageMetrics } from '../api/client'
import { WidgetShell, WidgetTitle } from './RiskScoreWidget'

interface DamageForecastWidgetProps {
  damageMetrics?: DamageMetrics
}

const inr = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
})

function formatINR(value: number): string {
  return '₹' + inr.format(value)
}

function DamageForecastWidget({ damageMetrics }: DamageForecastWidgetProps) {
  const recoverable = damageMetrics?.recoverable_amount ?? 450000
  const inTransit = damageMetrics?.in_transit_amount ?? 120000
  const isEstimated = damageMetrics?.is_estimated ?? true
  const estimationNote =
    damageMetrics?.estimation_note ??
    'Placeholder figures - no live evaluation data yet.'

  const totalExposure = recoverable + inTransit

  return (
    <WidgetShell className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative flex flex-col h-full">
        <div className="flex flex-row items-center justify-between">
          <WidgetTitle>Damage Forecast</WidgetTitle>
          {isEstimated && (
            <span className="badge badge-medium" title={estimationNote}>
              Estimated
            </span>
          )}
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex flex-row items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/15">
                <svg className="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16" />
                  <polyline points="23 21 16 14 9 21 4 16" />
                </svg>
              </div>
              <span className="text-body-sm text-foreground-muted">Recoverable Now</span>
            </div>
            <span className="font-mono font-semibold text-body-lg text-green-500">
              {formatINR(recoverable)}
            </span>
          </div>
          <div className="h-px w-full bg-border" />
          <div className="flex flex-row items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/15">
                <svg className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <span className="text-body-sm text-foreground-muted">In Transit</span>
            </div>
            <span className="font-mono font-semibold text-body-lg text-amber-500">
              {formatINR(inTransit)}
            </span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-purple-500/20">
          <div className="flex flex-row items-center justify-between">
            <span className="stat-label text-purple-400">Total Exposure</span>
            <span className="font-mono font-bold text-2xl text-purple-400">
              {formatINR(totalExposure)}
            </span>
          </div>
        </div>
        {isEstimated && (
          <p className="mt-3 text-caption text-foreground-muted leading-snug">
            {estimationNote}
          </p>
        )}
      </div>
    </WidgetShell>
  )
}

export default DamageForecastWidget
export { formatINR }