import { useState } from 'react'
import PageShell from '../components/PageShell'
import AccountsTable, {
  AccountsTableRow,
  MOCK_ACCOUNT_ROWS,
} from '../components/AccountsTable'
import { RiskLevel } from '../api/client'

type RiskFilter = 'ALL' | RiskLevel

const FILTERS: RiskFilter[] = ['ALL', 'Critical', 'High', 'Medium', 'Low']

function AccountsPage() {
  const [filter, setFilter] = useState<RiskFilter>('ALL')
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)

  const rows: AccountsTableRow[] =
    filter === 'ALL'
      ? MOCK_ACCOUNT_ROWS
      : MOCK_ACCOUNT_ROWS.filter((r) => r.risk_level === filter)

  return (
    <PageShell>
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Accounts Directory
          </h1>
          <p className="mt-2 text-sm text-foreground-muted">
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
                className={
                  'rounded-full border border-foreground px-5 py-2 text-xs font-medium uppercase tracking-wider transition-colors ' +
                  (isActive
                    ? 'bg-foreground text-background'
                    : 'bg-background text-foreground hover:bg-white/10')
                }
              >
                {f}
              </button>
            )
          })}
        </div>

        <AccountsTable
          rows={rows}
          activeAccountId={activeAccountId}
          onRowSelect={(id) => setActiveAccountId(id)}
        />
      </div>
    </PageShell>
  )
}

export default AccountsPage
