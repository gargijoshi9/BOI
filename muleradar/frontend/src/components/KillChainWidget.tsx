import { KillChainStage } from '../api/client'
import { WidgetShell, WidgetTitle } from './RiskScoreWidget'

interface KillChainWidgetProps {
  killChainStage?: KillChainStage
}

const KILL_CHAIN_STAGES: KillChainStage[] = [
  'None',
  'Placement',
  'Layering',
  'Integration',
]

const STAGE_LABELS: Record<KillChainStage, string> = {
  None: 'Monitoring',
  Placement: 'Placement',
  Layering: 'Layering',
  Integration: 'Integration',
}

const STAGE_COLORS: Record<KillChainStage, string> = {
  None: '#8892a6',
  Placement: '#eab308',
  Layering: '#f97316',
  Integration: '#ef4444',
}

const STAGE_BADGE: Record<KillChainStage, string> = {
  None: 'badge-teal',
  Placement: 'badge-medium',
  Layering: 'badge-high',
  Integration: 'badge-critical',
}

const ACTION_COPY: Record<KillChainStage, string> = {
  None: 'Continuous behavioral monitoring active',
  Placement: 'Initial fund placement detected — investigate source',
  Layering: 'Complex layering patterns — trace transaction flow',
  Integration: 'Funds re-entering legitimate economy — urgent review',
}

function KillChainWidget({ killChainStage }: KillChainWidgetProps) {
  const active: KillChainStage = killChainStage ?? 'None'
  const rawIndex = KILL_CHAIN_STAGES.indexOf(active)
  const activeIndex = rawIndex === -1 ? 0 : rawIndex
  const activeColor = STAGE_COLORS[active] ?? STAGE_COLORS.None
  const activeBadge = STAGE_BADGE[active] ?? STAGE_BADGE.None

  return (
    <WidgetShell>
      <div className="flex flex-col h-full">
        <WidgetTitle>Kill Chain Stage</WidgetTitle>
        <div className="mt-4 flex flex-1 items-center justify-center">
          <div className="flex flex-row items-center gap-2 overflow-x-auto px-2 pb-2 -mx-2">
            {KILL_CHAIN_STAGES.map((stage, i) => {
              const isActive = stage === active
              return (
                <div key={stage} className="flex flex-col items-center gap-2 shrink-0">
                  <div
                    className={`relative px-4 py-3 rounded-xl text-caption font-semibold uppercase tracking-wider transition-all duration-300 min-w-[110px] text-center ${
                      isActive
                        ? `${activeBadge} shadow-glow-${isActive ? 'strong' : ''}`
                        : 'text-foreground-muted bg-background-card border border-border'
                    }`}
                    style={isActive ? { boxShadow: `0 0 20px ${activeColor}40` } : undefined}
                  >
                    {STAGE_LABELS[stage]}
                  </div>
                  {i < KILL_CHAIN_STAGES.length - 1 && (
                    <div className="flex items-center justify-center h-6 w-6 text-foreground-subtle">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-4 p-4 rounded-xl bg-background-card border border-border/50">
          <p className="text-body-sm font-medium text-foreground" style={{ color: activeColor }}>
            Stage {activeIndex + 1} of {KILL_CHAIN_STAGES.length}
          </p>
          <p className="mt-1 text-body-sm text-foreground-muted">
            {ACTION_COPY[active] ?? ACTION_COPY.None}
          </p>
        </div>
      </div>
    </WidgetShell>
  )
}

export default KillChainWidget
export { STAGE_COLORS, STAGE_LABELS, KILL_CHAIN_STAGES }