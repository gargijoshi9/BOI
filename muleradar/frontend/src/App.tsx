import { Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AccountsPage from './pages/AccountsPage'
import NetworkPage from './pages/NetworkPage'
import { DrawerProvider } from './context/DrawerContext'

import LandingPage from './pages/LandingPage'

function App() {
  return (
    <DrawerProvider>
      <div className="min-h-screen bg-background text-foreground font-sans antialiased">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/network" element={<NetworkPage />} />
        </Routes>
      </div>
    </DrawerProvider>
  )
}

export default App
