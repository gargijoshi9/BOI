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

// Risk Level → matching glow shadow (same hues as the palette, kept
// subtle so the badge stays legible on the dark table background).
const RISK_GLOWS: Record<RiskLevel, string> = {
  Critical: '0 0 12px rgba(239, 68, 68, 0.4)',
  High: '0 0 12px rgba(249, 115, 22, 0.4)',
  Medium: '0 0 12px rgba(234, 179, 8, 0.4)',
  Low: '0 0 12px rgba(34, 197, 94, 0.4)',
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
    <div className="glass flex w-full flex-col p-7">
      <h3
        className="mb-3 text-xs font-medium uppercase"
        style={{ color: '#cbd5e1', letterSpacing: '0.18em' }}
      >
        Accounts Directory
      </h3>
      <div
        className="w-full overflow-x-auto"
        style={{
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 0,
        }}
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr
              className="text-left"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <th
                className="px-4 py-3 text-xs font-medium uppercase"
                style={{ color: '#94a3b8', letterSpacing: '0.18em' }}
              >
                Account ID
              </th>
              <th
                className="px-4 py-3 text-xs font-medium uppercase"
                style={{ color: '#94a3b8', letterSpacing: '0.18em' }}
              >
                Risk Score
              </th>
              <th
                className="px-4 py-3 text-xs font-medium uppercase"
                style={{ color: '#94a3b8', letterSpacing: '0.18em' }}
              >
                Risk Level
              </th>
              <th
                className="px-4 py-3 text-xs font-medium uppercase"
                style={{ color: '#94a3b8', letterSpacing: '0.18em' }}
              >
                Kill Chain Stage
              </th>
              <th
                className="px-4 py-3 text-xs font-medium uppercase"
                style={{ color: '#94a3b8', letterSpacing: '0.18em' }}
              >
                Recoverable Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-xs"
                  style={{ color: '#cbd5e1' }}
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
                    className="cursor-pointer"
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: isActive
                        ? 'rgba(34, 211, 238, 0.08)'
                        : 'transparent',
                      transition: 'background-color 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor =
                          'rgba(255, 255, 255, 0.03)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isActive
                        ? 'rgba(34, 211, 238, 0.08)'
                        : 'transparent'
                    }}
                  >
                    <td className="px-4 py-3 font-mono">
                      <span className="flex flex-row items-center gap-2">
                        <span style={{ color: '#22d3ee' }}>{row.account_id}</span>
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
                    <td
                      className="px-4 py-3 tabular-nums"
                      style={{ color: '#f8fafc', fontWeight: 600 }}
                    >
                      {row.risk_score}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: RISK_COLORS[row.risk_level],
                          color: '#000000',
                          boxShadow: RISK_GLOWS[row.risk_level],
                        }}
                      >
                        {row.risk_level}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: '#94a3b8' }}
                    >
                      {row.kill_chain_stage}
                    </td>
                    <td
                      className="px-4 py-3 tabular-nums"
                      style={{ color: '#a855f7', fontWeight: 600 }}
                    >
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
