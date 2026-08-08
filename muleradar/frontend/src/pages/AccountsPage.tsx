import { useEffect, useState } from 'react'
import PageShell from '../components/PageShell'
import AccountsTable, { AccountsTableRow } from '../components/AccountsTable'
import { RiskLevel, fetchAccounts } from '../api/client'

type RiskFilter = 'ALL' | RiskLevel

const FILTERS: RiskFilter[] = ['ALL', 'Critical', 'High', 'Medium', 'Low']

function AccountsPage() {
  const [filter, setFilter] = useState<RiskFilter>('ALL')
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<AccountsTableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAccounts() {
      try {
        setLoading(true)
        const data = await fetchAccounts(100)
        setAccounts(data)
      } catch (err) {
        setError('Failed to fetch accounts from backend')
      } finally {
        setLoading(false)
      }
    }
    loadAccounts()
  }, [])

  const rows =
    filter === 'ALL'
      ? accounts
      : accounts.filter((r) => r.risk_level === filter)

  return (
    <PageShell>
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-6">
        <div>
          <h1
            className="text-2xl"
            style={{ color: '#f8fafc', fontWeight: 800 }}
          >
            Accounts Directory
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#94a3b8' }}>
            All flagged accounts sorted by risk score
          </p>
        </div>

        <div className="flex flex-row items-center gap-3">
          {FILTERS.map((f) => {
            const isActive = f === filter
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="px-5 py-2 text-xs font-medium uppercase tracking-wider"
                style={{
                  // Active: cyan-tinted glass w/ outer glow. Inactive:
                  // subtle glass. All states transition on 150ms ease.
                  background: isActive
                    ? 'rgba(34, 211, 238, 0.08)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: isActive
                    ? '1px solid rgba(34, 211, 238, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  color: isActive ? '#22d3ee' : '#cbd5e1',
                  boxShadow: isActive
                    ? '0 0 12px rgba(34, 211, 238, 0.15)'
                    : 'none',
                  borderRadius: '9999px',
                  transition: 'all 150ms ease',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }}
                onMouseEnter={(e) => {
                  if (isActive) return
                  e.currentTarget.style.borderColor =
                    'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.color = '#f8fafc'
                }}
                onMouseLeave={(e) => {
                  if (isActive) return
                  e.currentTarget.style.borderColor =
                    'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.color = '#cbd5e1'
                }}
              >
                {f}
              </button>
            )
          })}
        </div>

        {loading && (
          <p className="text-xs" style={{ color: '#94a3b8' }}>
            Loading directory...
          </p>
        )}
        {error && (
          <p className="text-xs" style={{ color: '#ef4444' }}>
            {error}
          </p>
        )}

        {!loading && !error && (
          <AccountsTable
            rows={rows}
            activeAccountId={activeAccountId}
            onRowSelect={(id) => setActiveAccountId(id)}
          />
        )}
      </div>
    </PageShell>
  )
}

export default AccountsPage
