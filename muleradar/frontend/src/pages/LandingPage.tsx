import { useState, useEffect } from 'react'
import Navbar from '../components/landing/Navbar'
import Hero from '../components/landing/Hero'
import FloatingCards from '../components/landing/FloatingCards'
import GradientBlinds from '../components/landing/GradientBlinds'
import ProblemSection from '../components/landing/ProblemSection'
import SolutionSection from '../components/landing/SolutionSection'
import WhyUsSection from '../components/landing/WhyUsSection'

function LandingPage() {
  const [spotlightRadius, setSpotlightRadius] = useState(0.2)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSpotlightRadius(0.12)
      } else {
        setSpotlightRadius(0.2)
      }
    }
    
    handleResize()
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground font-sans selection:bg-accent/30">
      <div className="absolute inset-0 z-0 w-full h-full opacity-50">
        <GradientBlinds
          gradientColors={['#0A1526', '#162b4a', '#00d4aa']}
          dpr={window.devicePixelRatio || 1}
          angle={-30}
          noise={0.15}
          blindCount={12}
          blindMinWidth={50}
          spotlightRadius={spotlightRadius}
          spotlightSoftness={1.5}
          spotlightOpacity={0.8}
          mouseDampening={0.02}
          distortAmount={0.2}
          shineDirection="left"
          mixBlendMode="screen"
          className="w-full h-full"
        />
      </div>
      <div className="absolute inset-0 z-0 mesh-bg pointer-events-none" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6 lg:px-8">
        <Navbar />

        <main className="flex flex-1 flex-col">
          <Hero />
          <FloatingCards />
          <ProblemSection />
          <SolutionSection />
          <WhyUsSection />
        </main>
      </div>

      {/* Footer spans full width */}
      <footer className="relative z-10 bg-[#0A1526]/80 backdrop-blur-md border-t border-white/5 pt-16 pb-8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-teal-500">
                  <svg className="h-5 w-5 text-navy-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <span className="font-bold text-xl text-foreground tracking-tight">MuleRadar</span>
              </div>
              <p className="text-foreground-muted text-sm max-w-md">
                Built for the Bank of India Hackathon. MuleRadar leverages real-time behavioral analytics and machine learning to detect and stop money mule accounts before they move illicit funds.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-4">Product</h3>
              <ul className="space-y-3 text-sm text-foreground-muted">
                <li><a href="#" className="hover:text-accent transition-colors">Risk Analysis</a></li>
                <li><a href="#" className="hover:text-accent transition-colors">Network Graph</a></li>
                <li><a href="#" className="hover:text-accent transition-colors">Account Monitoring</a></li>
                <li><a href="#" className="hover:text-accent transition-colors">API Integration</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-4">Hackathon</h3>
              <ul className="space-y-3 text-sm text-foreground-muted">
                <li><a href="#" className="hover:text-accent transition-colors">Bank of India</a></li>
                <li><a href="#" className="hover:text-accent transition-colors">Problem Statement</a></li>
                <li><a href="#" className="hover:text-accent transition-colors">Architecture</a></li>
                <li><a href="#" className="hover:text-accent transition-colors">GitHub Repo</a></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/5 gap-6 text-xs text-foreground-muted">
            <p>© 2026 Team ORANGE. Built for BoI Hackathon.</p>
            <div className="flex items-center gap-6">
              <a href="#privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="#terms" className="hover:text-foreground transition-colors">Terms of Service</a>
              <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage