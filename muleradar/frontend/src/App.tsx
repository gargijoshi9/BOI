import { Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AccountsPage from './pages/AccountsPage'
import NetworkPage from './pages/NetworkPage'
import SHAPPage from './pages/SHAPPage'
import ValidationPage from './pages/ValidationPage'
import MonitorPage from './pages/MonitorPage'
import AuditPage from './pages/AuditPage'
import { DrawerProvider } from './context/DrawerContext'
import { AppProvider } from './context/AppContext'

import LandingPage from './pages/LandingPage'
import { ReviewQueuePage } from './pages/ReviewQueuePage'

function App() {
  return (
    <DrawerProvider>
      <AppProvider>
        <div className="min-h-screen bg-background text-foreground font-sans antialiased">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/shap" element={<SHAPPage />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/review-queue" element={<ReviewQueuePage />} />
            <Route path="/validate" element={<ValidationPage />} />
            <Route path="/monitor" element={<MonitorPage />} />
            <Route path="/audit" element={<AuditPage />} />
          </Routes>
        </div>
      </AppProvider>
    </DrawerProvider>
  )
}

export default App