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

  return (
    <WidgetShell>
      <WidgetTitle>Damage Forecast</WidgetTitle>
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
    </WidgetShell>
  )
}

export default DamageForecastWidget
export { formatINR }
