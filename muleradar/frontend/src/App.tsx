import { Route, Routes, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AccountsPage from './pages/AccountsPage'
import NetworkPage from './pages/NetworkPage'
import SHAPPage from './pages/SHAPPage'
import LoginPage from './pages/LoginPage'
import ModelMonitorPage from './pages/ModelMonitorPage'
import ValidatePage from './pages/ValidatePage'
import AuditTrailPage from './pages/AuditTrailPage'
import { DrawerProvider } from './context/DrawerContext'
import { AppProvider } from './context/AppContext'

import LandingPage from './pages/LandingPage'

function App() {
  return (
    <DrawerProvider>
      <AppProvider>
        <div className="min-h-screen bg-background text-foreground font-sans antialiased">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/shap" element={<SHAPPage />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/monitor" element={<ModelMonitorPage />} />
            <Route path="/validate" element={<ValidatePage />} />
            <Route path="/audit" element={<AuditTrailPage />} />
          </Routes>
        </div>
      </AppProvider>
    </DrawerProvider>
  )
}

export default App
