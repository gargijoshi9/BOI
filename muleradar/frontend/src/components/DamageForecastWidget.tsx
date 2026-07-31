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
  // Default to true (not false) when no metrics were passed at all - a
  // widget with no real data behind it should never look "verified" by
  // default. Real, confirmed figures are the exception that has to
  // explicitly say so, not the other way around.
  const isEstimated = damageMetrics?.is_estimated ?? true
  const estimationNote =
    damageMetrics?.estimation_note ??
    'Placeholder figures - no live evaluation data yet.'

  return (
    <WidgetShell>
      <div className="flex flex-row items-center justify-between">
        <WidgetTitle>Damage Forecast</WidgetTitle>
        {isEstimated && (
          <span
            title={estimationNote}
            className="inline-flex items-center border border-[#eab308] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#eab308]"
          >
            Estimated
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-col">
        <div className="flex flex-row items-center justify-between py-3">
          <span className="text-xs text-foreground-muted">Recoverable Now</span>
          <span className="text-sm text-foreground">
            {formatINR(recoverable)}
          </span>
        </div>
        <div className="h-px w-full bg-foreground" />
        <div className="flex flex-row items-center justify-between py-3">
          <span className="text-xs text-foreground-muted">In Transit</span>
          <span className="text-sm text-foreground">
            {formatINR(inTransit)}
          </span>
        </div>
        <div className="h-px w-full bg-foreground" />
      </div>
      {isEstimated && (
        <p className="mt-3 text-[11px] leading-snug text-foreground-muted">
          {estimationNote}
        </p>
      )}
    </WidgetShell>
  )
}

export default DamageForecastWidget
export { formatINR }