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
    <div className="glass glow-cyan flex flex-1 flex-col p-5">
      <span className="text-2xl font-bold text-gradient-cyan-purple">
        {value}
      </span>
      <span
        className="mt-2 text-xs uppercase"
        style={{
          color: '#94a3b8',
          letterSpacing: '0.18em',
        }}
      >
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
          <h1
            className="text-2xl"
            style={{ color: '#f8fafc', fontWeight: 800 }}
          >
            Transaction Network
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#94a3b8' }}>
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
