import {
  DamageMetrics,
  KillChainStage,
  NetworkConnections,
  RiskEvaluationResponse,
  RiskLevel,
  ShapFeature,
} from '../api/client'
import AccountsTable, { AccountsTableRow } from './AccountsTable'
import DamageForecastWidget from './DamageForecastWidget'
import KillChainWidget from './KillChainWidget'
import NetworkGraph from './NetworkGraph'
import RiskScoreWidget from './RiskScoreWidget'
import ShapWidget from './ShapWidget'

interface MainGridProps {
  riskScore?: number
  riskLevel?: RiskLevel
  killChainStage?: KillChainStage
  damageMetrics?: DamageMetrics
  shapExplanation?: ShapFeature[]
  networkConnections?: NetworkConnections
  accounts?: AccountsTableRow[]
  activeAccountId?: string | null
  onAccountSelect?: (accountId: string) => void
}

function MainGrid(props: MainGridProps) {
  return (
    <section className="flex h-full flex-1 flex-col gap-8 overflow-y-auto p-6">
      {/* Row 1 — three widgets */}
      <div className="flex flex-row gap-5">
        <RiskScoreWidget
          riskScore={props.riskScore}
          riskLevel={props.riskLevel}
        />
        <KillChainWidget killChainStage={props.killChainStage} />
        <DamageForecastWidget damageMetrics={props.damageMetrics} />
      </div>

      {/* Row 2 — SHAP explanation */}
      <ShapWidget shapExplanation={props.shapExplanation} />

      {/* Row 3 — Network graph */}
      <NetworkGraph networkConnections={props.networkConnections} />

      {/* Row 4 — Accounts directory */}
      <AccountsTable
        rows={props.accounts}
        onRowSelect={props.onAccountSelect}
        activeAccountId={props.activeAccountId}
      />
    </section>
  )
}

export default MainGrid
export type { RiskEvaluationResponse }
