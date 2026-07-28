import PageShell from '../components/PageShell'
import NetworkGraph from '../components/NetworkGraph'
import { formatINR } from '../components/DamageForecastWidget'

interface StatCard {
  value: string
  label: string
}

const STATS: StatCard[] = [
  { value: '6 Nodes', label: 'Accounts in ring' },
  { value: '6 Edges', label: 'Transaction links' },
  { value: formatINR(565000), label: 'Total flow detected' },
]

function StatCard({ value, label }: StatCard) {
  return (
    <div className="flex flex-1 flex-col border border-border bg-background p-5">
      <span className="text-2xl font-bold text-foreground">{value}</span>
      <span className="mt-2 text-xs uppercase tracking-widest text-foreground-muted">
        {label}
      </span>
    </div>
  )
}

function NetworkPage() {
  return (
    <PageShell>
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Transaction Network
          </h1>
          <p className="mt-2 text-sm text-foreground-muted">
            Live fraud ring visualization
          </p>
        </div>

        <NetworkGraph height={500} />

        <div className="flex flex-row gap-4">
          {STATS.map((s) => (
            <StatCard key={s.label} value={s.value} label={s.label} />
          ))}
        </div>
      </div>
    </PageShell>
  )
}

export default NetworkPage
