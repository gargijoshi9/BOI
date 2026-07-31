import { DamageMetrics, KillChainStage, RiskLevel } from '../api/client'
import { RISK_COLORS } from './RiskScoreWidget'
import { formatINR } from './DamageForecastWidget'

export interface AccountsTableRow {
  account_id: string
  risk_score: number
  risk_level: RiskLevel
  kill_chain_stage: KillChainStage
  damage_metrics?: DamageMetrics
  is_simulated?: boolean
}

interface AccountsTableProps {
  rows?: AccountsTableRow[]
  onRowSelect?: (accountId: string) => void
  activeAccountId?: string | null
}

function AccountsTable({
  rows,
  onRowSelect,
  activeAccountId,
}: AccountsTableProps) {
  const data = rows && rows.length > 0 ? rows : []

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
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-xs text-foreground-muted"
                >
                  No accounts found
                </td>
              </tr>
            ) : (
              data.map((row) => {
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
                      <span className="flex flex-row items-center gap-2">
                        {row.account_id}
                        {row.is_simulated && (
                          <span
                            title="Simulated result - no trained model artifacts matched this account. Not a verified prediction."
                            className="inline-flex items-center bg-[#ef4444] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                          >
                            Sim
                          </span>
                        )}
                      </span>
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
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AccountsTable