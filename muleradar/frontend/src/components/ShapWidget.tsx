import { useEffect, useRef, useState } from 'react'
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

  // Width-on-mount: each bar starts at 0 and animates to its target
  // width on first paint via a 50ms-deferred state flip. Triggered
  // once per feature set so the bars don't re-animate on every
  // re-render (e.g. when the parent re-renders for unrelated reasons).
  const [animated, setAnimated] = useState(false)
  const featuresKey = features
    .map((f) => `${f.feature}:${f.contribution}`)
    .join('|')
  const prevKey = useRef<string | null>(null)

  useEffect(() => {
    // Reset on new data so the bars animate again when the explanation
    // changes (e.g. user evaluates a new account).
    if (prevKey.current !== null && prevKey.current !== featuresKey) {
      setAnimated(false)
      const t = setTimeout(() => setAnimated(true), 50)
      prevKey.current = featuresKey
      return () => clearTimeout(t)
    }
    prevKey.current = featuresKey
    const t = setTimeout(() => setAnimated(true), 50)
    return () => clearTimeout(t)
  }, [featuresKey])

  return (
    <div className="glass flex w-full flex-col p-7">
      <h3
        className="text-xs font-medium uppercase"
        style={{ color: '#cbd5e1', letterSpacing: '0.18em' }}
      >
        SHAP Explanation
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
              <span
                className="w-44 truncate text-xs"
                style={{ color: '#94a3b8' }}
              >
                {f.feature}
              </span>
              <div
                className="relative h-[6px] flex-1"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: 0,
                }}
              >
                <div
                  className={
                    'shap-bar h-full ' + (animated ? '' : 'shap-bar-initial')
                  }
                  style={{
                    width: `${widthPct}%`,
                    background:
                      'linear-gradient(90deg, #22d3ee, #a855f7)',
                    borderRadius: 0,
                  }}
                />
              </div>
              <span
                className="w-20 text-right text-xs tabular-nums"
                style={{ color: '#22d3ee', fontWeight: 600 }}
              >
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
