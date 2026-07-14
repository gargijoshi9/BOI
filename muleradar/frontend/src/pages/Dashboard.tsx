import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import MainGrid from '../components/MainGrid'
import RightPanel from '../components/RightPanel'

function Dashboard() {
  return (
    <div className="flex h-screen w-screen flex-row overflow-hidden bg-background text-foreground">
      <Sidebar />

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <TopBar />

        <div className="flex flex-1 flex-row overflow-hidden">
          <MainGrid />
          <RightPanel />
        </div>
      </div>
    </div>
  )
}

export default Dashboard
