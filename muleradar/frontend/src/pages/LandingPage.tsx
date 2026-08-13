import Navbar from '../components/landing/Navbar'
import Hero from '../components/landing/Hero'
import FloatingCards from '../components/landing/FloatingCards'

function LandingPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground font-sans selection:bg-accent/30">
      <div className="absolute inset-0 -z-10 mesh-bg" />
      
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6 lg:px-8">
        <Navbar />
        
        <main className="flex flex-1 flex-col">
          <Hero />
          <FloatingCards />
          
          <footer className="py-12 border-t border-border/50 mt-auto">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-body-sm text-foreground-muted">
                <p>© 2025 MuleRadar. All rights reserved.</p>
                <div className="flex items-center gap-6">
                  <a href="#privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
                  <a href="#terms" className="hover:text-foreground transition-colors">Terms of Service</a>
                  <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
                </div>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}

export default LandingPage