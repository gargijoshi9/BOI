import { Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </div>
  )
}

export default App
