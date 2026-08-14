import { Link } from 'react-router-dom'

const STATS = [
  { value: '10B+', label: 'Transactions Analyzed' },
  { value: '<500ms', label: 'Risk Assessment Latency' },
  { value: '99.2%', label: 'Detection Accuracy' },
  { value: '500M+', label: 'Accounts Protected' },
] as const



function Hero() {
  return (
    <section className="relative flex flex-1 flex-col items-center justify-center pt-20 pb-16 lg:pt-32 lg:pb-24 animate-fade-in">
      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-caption font-medium uppercase tracking-wider mb-8 animate-slide-up">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent"></span>
            </span>
            Behavioral Intelligence for Mule Account Detection
          </div>

          <h1 className="text-display-xl font-black text-foreground tracking-tight text-balance animate-slide-up stagger-1">
            Stop Mule Accounts
            <br />
            <span className="gradient-text-accent">Before They Move Money</span>
          </h1>

          <p className="mt-6 text-body-lg text-foreground-muted max-w-2xl mx-auto animate-slide-up stagger-2">
            MuleRadar uses real-time behavioral analytics, network graph intelligence, and ML ensemble models
            to detect mule accounts days before traditional controls — protecting your institution from financial crime.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up stagger-3">
            <Link to="/dashboard" className="btn-primary w-full sm:w-auto">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Launch Console
            </Link>
            <a href="#demo" className="btn-secondary w-full sm:w-auto">
              Request Demo
            </a>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 animate-slide-up stagger-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="stat-number">{stat.value}</div>
                <div className="mt-1 stat-label">{stat.label}</div>
              </div>
            ))}
          </div>


        </div>
      </div>

      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-teal-500/5 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-accent/3 blur-[100px]" />
      </div>
    </section>
  )
}

export default Hero