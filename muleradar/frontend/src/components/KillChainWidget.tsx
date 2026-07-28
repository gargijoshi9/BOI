import { KillChainStage } from '../api/client'
import { WidgetShell, WidgetTitle } from './RiskScoreWidget'

interface KillChainWidgetProps {
  killChainStage?: KillChainStage
}

const KILL_CHAIN_STAGES: KillChainStage[] = [
  'Placement',
  'Layering',
  'Integration',
]

const STAGE_COLORS: Record<KillChainStage, string> = {
  Placement: '#eab308',
  Layering: '#f97316',
  Integration: '#ef4444',
}

function KillChainWidget({ killChainStage }: KillChainWidgetProps) {
  const active: KillChainStage = killChainStage ?? 'Placement'
  const activeIndex = KILL_CHAIN_STAGES.indexOf(active)
  const activeColor = STAGE_COLORS[active]

  return (
    <WidgetShell>
      <WidgetTitle>Kill Chain Stage</WidgetTitle>
      <div className="mt-4 flex flex-row gap-2">
        {KILL_CHAIN_STAGES.map((stage) => {
          const isActive = stage === active
          return (
            <div
              key={stage}
              className={
                'flex h-9 flex-1 items-center justify-center border px-2 ' +
                (isActive
                  ? 'text-background'
                  : 'border-border bg-background text-foreground-muted')
              }
              style={
                isActive
                  ? { backgroundColor: activeColor, borderColor: activeColor }
                  : undefined
              }
            >
              <span className="text-[11px] font-medium uppercase tracking-wide">
                {stage}
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-6 text-xs text-foreground">
        Stage {activeIndex + 1} of {KILL_CHAIN_STAGES.length} —{' '}
        Immediate action required
      </p>
    </WidgetShell>
  )
}

export default KillChainWidget
export { STAGE_COLORS, KILL_CHAIN_STAGES }
