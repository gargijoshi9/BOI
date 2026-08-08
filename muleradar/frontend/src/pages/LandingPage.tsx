import Navbar from '../components/landing/Navbar'
import Hero from '../components/landing/Hero'
import FloatingCards from '../components/landing/FloatingCards'

function LandingPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white font-sans selection:bg-cyan-500/30">
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
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-black via-black/80 to-transparent" />

      {/* Main Content */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6 sm:px-12 lg:px-24">
        <Navbar />

        <main className="flex flex-1 flex-col items-center justify-between lg:flex-row pb-20">
          <Hero />
          <FloatingCards />
        </main>
      </div>
    </div>
  )
}

export default LandingPage
