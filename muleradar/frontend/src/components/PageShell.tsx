import { ReactNode, useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import AIDrawer from './AIDrawer'

interface PageShellProps {
  children: ReactNode
}

function PageShell({ children }: PageShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="relative flex h-screen w-screen flex-row overflow-hidden bg-background text-foreground selection:bg-accent/30 font-sans">
      <div className="absolute inset-0 -z-10 mesh-bg" />
      
      <div className="relative z-10 flex h-full w-full flex-row overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex h-full flex-1 flex-col overflow-hidden">
          <TopBar onMenuClick={() => setIsSidebarOpen(true)} />
          <div className="flex flex-1 flex-row overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
            <AIDrawer />
          </div>
        </div>
      </div>
    </div>
  )
}

export default PageShell