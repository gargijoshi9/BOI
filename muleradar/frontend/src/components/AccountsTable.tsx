import { DamageMetrics, RiskLevel } from '../api/client'
import { RISK_COLORS } from './RiskScoreWidget'
import { formatINR } from './DamageForecastWidget'

export interface AccountsTableRow {
  account_id: string
  risk_score: number
  risk_level: RiskLevel
  kill_chain_stage: string
  damage_metrics?: DamageMetrics
}

interface AccountsTableProps {
  rows?: AccountsTableRow[]
  onRowSelect?: (accountId: string) => void
  activeAccountId?: string | null
}

const MOCK_ROWS: AccountsTableRow[] = [
  {
    account_id: 'AC7821',
    risk_score: 91,
    risk_level: 'Critical',
    kill_chain_stage: 'Layering',
    damage_metrics: { recoverable_amount: 450000, in_transit_amount: 120000 },
  },
  {
    account_id: 'AC4430',
    risk_score: 74,
    risk_level: 'High',
    kill_chain_stage: 'Integration',
    damage_metrics: { recoverable_amount: 210000, in_transit_amount: 85000 },
  },
  {
    account_id: 'AC1198',
    risk_score: 52,
    risk_level: 'Medium',
    kill_chain_stage: 'Placement',
    damage_metrics: { recoverable_amount: 80000, in_transit_amount: 40000 },
  },
  {
    account_id: 'AC0023',
    risk_score: 18,
    risk_level: 'Low',
    kill_chain_stage: 'Placement',
    damage_metrics: { recoverable_amount: 12000, in_transit_amount: 0 },
  },
]

export { MOCK_ROWS as MOCK_ACCOUNT_ROWS }

function AccountsTable({
  rows,
  onRowSelect,
  activeAccountId,
}: AccountsTableProps) {
  const data = rows && rows.length > 0 ? rows : MOCK_ROWS

  return (
    <div className="flex w-full flex-col">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-foreground-muted">
        ACCOUNTS DIRECTORY
      </h3>
      <div className="w-full overflow-x-auto border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-border bg-background text-left">
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-foreground-muted">
                Account ID
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-foreground-muted">
                Risk Score
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-foreground-muted">
                Risk Level
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-foreground-muted">
                Kill Chain Stage
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-foreground-muted">
                Recoverable Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isActive = row.account_id === activeAccountId
              return (
                <tr
                  key={row.account_id}
                  onClick={() => onRowSelect?.(row.account_id)}
                  className={
                    'cursor-pointer border-b border-border last:border-b-0 transition-colors ' +
                    (isActive ? 'bg-white/10' : 'hover:bg-white/5')
                  }
                >
                  <td className="px-4 py-3 font-mono text-foreground">
                    {row.account_id}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground">
                    {row.risk_score}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: RISK_COLORS[row.risk_level],
                        color: '#000000',
                      }}
                    >
                      {row.risk_level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {row.kill_chain_stage}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground">
                    {formatINR(row.damage_metrics?.recoverable_amount ?? 0)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AccountsTable
