import NetworkGraph from './NetworkGraph'

const KILL_CHAIN_STAGES = [
  'Recruitment',
  'Preparation',
  'Fund Reception',
  'Layering',
  'Cash Out',
] as const

const ACTIVE_STAGE = 'Fund Reception'
const ACTIVE_STAGE_INDEX = KILL_CHAIN_STAGES.indexOf(ACTIVE_STAGE) // 2 → "Stage 3 of 5"

function WidgetShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col border border-border bg-background p-6">
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

function MainGrid() {
  return (
    <section className="flex h-full flex-1 flex-col gap-4 p-6">
      <div className="flex flex-1 flex-row gap-4">
      {/* Widget 1 — Risk Score Panel */}
      <WidgetShell>
        <WidgetTitle>Risk Score</WidgetTitle>
        <div className="mt-4 flex flex-row items-baseline justify-center gap-2">
          <span className="text-7xl font-bold leading-none text-foreground">
            91
          </span>
          <span className="text-lg text-foreground-muted">/100</span>
        </div>
        <div className="mt-6 h-[2px] w-full bg-foreground" />
        <p className="mt-4 text-xs text-foreground-muted">Account: AC7821</p>
      </WidgetShell>

      {/* Widget 2 — Kill Chain Stage */}
      <WidgetShell>
        <WidgetTitle>Kill Chain Stage</WidgetTitle>
        <div className="mt-4 flex flex-row gap-2">
          {KILL_CHAIN_STAGES.map((stage) => {
            const isActive = stage === ACTIVE_STAGE
            return (
              <div
                key={stage}
                className={
                  'flex h-9 flex-1 items-center justify-center border border-border px-2 ' +
                  (isActive
                    ? 'bg-foreground text-background'
                    : 'bg-background text-foreground-muted')
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
          Stage {ACTIVE_STAGE_INDEX + 1} of {KILL_CHAIN_STAGES.length} —{' '}
          Immediate action required
        </p>
      </WidgetShell>

      {/* Widget 3 — Damage Forecast */}
      <WidgetShell>
        <WidgetTitle>Damage Forecast</WidgetTitle>
        <div className="mt-4 flex flex-col">
          <div className="flex flex-row items-center justify-between py-3">
            <span className="text-xs text-foreground-muted">Recoverable Now</span>
            <span className="text-sm text-foreground">₹4,50,000</span>
          </div>
          <div className="h-px w-full bg-foreground" />
          <div className="flex flex-row items-center justify-between py-3">
            <span className="text-xs text-foreground-muted">In Transit</span>
            <span className="text-sm text-foreground">₹1,20,000</span>
          </div>
          <div className="h-px w-full bg-foreground" />
          <div className="flex flex-row items-center justify-between py-3">
            <span className="text-xs text-foreground-muted">
              Expected Loss (24h)
            </span>
            <span className="text-sm text-foreground">₹2,80,000</span>
          </div>
          <div className="h-px w-full bg-foreground" />
        </div>
        <p className="mt-4 text-sm font-bold text-foreground">
          Total Exposure: ₹8,50,000
        </p>
      </WidgetShell>
      </div>
      <NetworkGraph />
    </section>
  )
}

export default MainGrid
