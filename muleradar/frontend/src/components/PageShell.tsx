import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import AIDrawer from './AIDrawer'

interface PageShellProps {
  children: ReactNode
}

function PageShell({ children }: PageShellProps) {
  return (
    <div className="relative flex h-screen w-screen flex-row overflow-hidden bg-black text-white selection:bg-cyan-500/30 font-sans">
      {/* Background Image Layer */}
      <div 
        className="absolute inset-0 z-0 opacity-80"
        style={{
          backgroundImage: 'url(/bg-neon.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      {/* Dark Gradient Overlay to ensure text readability */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/85 via-black/90 to-black pointer-events-none" />

      {/* Main Content Layers */}
      <div className="relative z-10 flex h-full w-full flex-row overflow-hidden">
        <Sidebar />
        <div className="flex h-full flex-1 flex-col overflow-hidden">
          <TopBar />
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
