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

  // Total exposure = sum of recoverable + in-transit. This is a
  // presentation-only derivation from data already on screen; no
  // additional state.
  const totalExposure = recoverable + inTransit

  return (
    <WidgetShell extraClassName="glow-purple">
      <div className="flex flex-row items-center justify-between">
        <WidgetTitle>Damage Forecast</WidgetTitle>
        {isEstimated && (
          <span
            title={estimationNote}
            className="inline-flex items-center border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              borderColor: '#eab308',
              color: '#eab308',
            }}
          >
            Estimated
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-col">
        <div className="flex flex-row items-center justify-between py-3">
          <span className="text-xs" style={{ color: '#cbd5e1' }}>
            Recoverable Now
          </span>
          <span
            className="text-sm"
            style={{ color: '#f8fafc', fontWeight: 600 }}
          >
            {formatINR(recoverable)}
          </span>
        </div>
        <div
          className="h-px w-full"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
        />
        <div className="flex flex-row items-center justify-between py-3">
          <span className="text-xs" style={{ color: '#cbd5e1' }}>
            In Transit
          </span>
          <span
            className="text-sm"
            style={{ color: '#f8fafc', fontWeight: 600 }}
          >
            {formatINR(inTransit)}
          </span>
        </div>
        <div
          className="h-px w-full"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
        />
      </div>
      {/* Total Exposure row — purple accent as the headline figure. */}
      <div
        className="mt-3 pt-3"
        style={{ borderTop: '1px solid rgba(168, 85, 247, 0.2)' }}
      >
        <div className="flex flex-row items-center justify-between">
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: '#a855f7' }}
          >
            Total Exposure
          </span>
          <span
            className="text-base"
            style={{ color: '#a855f7', fontWeight: 700 }}
          >
            {formatINR(totalExposure)}
          </span>
        </div>
      </div>
      {isEstimated && (
        <p
          className="mt-3 text-[11px] leading-snug"
          style={{ color: '#cbd5e1' }}
        >
          {estimationNote}
        </p>
      )}
    </WidgetShell>
  )
}

export default DamageForecastWidget
export { formatINR }
