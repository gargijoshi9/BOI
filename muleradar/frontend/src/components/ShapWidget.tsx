import { ShapFeature } from '../api/client'

interface ShapWidgetProps {
  shapExplanation?: ShapFeature[]
}

function ShapWidget({ shapExplanation }: ShapWidgetProps) {
  const features =
    shapExplanation && shapExplanation.length > 0
      ? shapExplanation
      : [
          { feature: 'tx_velocity_24h', contribution: 0.32 },
          { feature: 'cross_border_ratio', contribution: 0.24 },
          { feature: 'device_reuse_count', contribution: 0.18 },
          { feature: 'kyc_age_days', contribution: 0.12 },
          { feature: 'avg_tx_size', contribution: 0.08 },
        ]

  const maxAbs = Math.max(...features.map((f) => Math.abs(f.contribution)), 0.001)

  return (
    <div className="flex w-full flex-col border border-border bg-background p-7">
      <h3 className="text-xs font-medium uppercase tracking-widest text-foreground-muted">
        SHAP EXPLANATION
      </h3>
      <div className="mt-4 flex flex-col gap-3">
        {features.map((f) => {
          const widthPct = Math.max(
            0,
            Math.min(100, (Math.abs(f.contribution) / maxAbs) * 100),
          )
          return (
            <div
              key={f.feature}
              className="flex flex-row items-center gap-4"
            >
              <span className="w-44 truncate text-xs text-foreground">
                {f.feature}
              </span>
              <div className="relative h-3 flex-1 border border-border bg-background">
                <div
                  className="h-full bg-foreground"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="w-20 text-right text-xs tabular-nums text-foreground-muted">
                {f.contribution.toFixed(3)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ShapWidget
