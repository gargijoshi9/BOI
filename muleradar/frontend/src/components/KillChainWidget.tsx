import { KillChainStage } from '../api/client'
import { WidgetShell, WidgetTitle } from './RiskScoreWidget'

interface KillChainWidgetProps {
  killChainStage?: KillChainStage
}

// 'None' is included deliberately - it's a real value analyzer.py sends
// for Low-risk accounts with no active kill-chain stage. Previously this
// wasn't in the stages array at all, which made indexOf() return -1 and
// broke both the "Stage X of Y" counter and the active-pill color lookup.
// Every value the backend can actually emit must have an explicit entry
// here, even ones that represent "nothing is happening."
const KILL_CHAIN_STAGES: KillChainStage[] = [
  'None',
  'Placement',
  'Layering',
  'Integration',
]

// User-facing label per stage - 'None' reads oddly as a raw badge, so it
// gets a clearer "Monitoring" label instead.
const STAGE_LABELS: Record<KillChainStage, string> = {
  None: 'Monitoring',
  Placement: 'Placement',
  Layering: 'Layering',
  Integration: 'Integration',
}

const STAGE_COLORS: Record<KillChainStage, string> = {
  // Muted gray-blue rather than a "warning" color - this state means no
  // active kill-chain stage was detected, not a lower-severity alert.
  None: '#64748b',
  Placement: '#eab308',
  Layering: '#f97316',
  Integration: '#ef4444',
}

const ACTION_COPY: Record<KillChainStage, string> = {
  None: 'Continuous monitoring',
  Placement: 'Immediate action required',
  Layering: 'Immediate action required',
  Integration: 'Immediate action required',
}

function KillChainWidget({ killChainStage }: KillChainWidgetProps) {
  const active: KillChainStage = killChainStage ?? 'None'
  const rawIndex = KILL_CHAIN_STAGES.indexOf(active)
  // Defensive fallback: if a stage value ever arrives that isn't in the
  // array above (e.g. mid-rollout of a backend change), default to the
  // first position instead of rendering "Stage 0 of 4" / negative math.
  const activeIndex = rawIndex === -1 ? 0 : rawIndex
  const activeColor = STAGE_COLORS[active] ?? STAGE_COLORS.None

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
                {STAGE_LABELS[stage]}
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-6 text-xs text-foreground">
        Stage {activeIndex + 1} of {KILL_CHAIN_STAGES.length} —{' '}
        {ACTION_COPY[active] ?? ACTION_COPY.None}
      </p>
    </WidgetShell>
  )
}

export default KillChainWidget
export { STAGE_COLORS, STAGE_LABELS, KILL_CHAIN_STAGES }