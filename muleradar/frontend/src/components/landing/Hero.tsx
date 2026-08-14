import { Link } from 'react-router-dom'

const KILL_CHAIN_STEPS = [
  { id: '01', title: 'Infiltration', desc: 'Synthetic ID / ATO' },
  { id: '02', title: 'Dormancy', desc: 'Aging to build trust' },
  { id: '03', title: 'Layering', desc: 'Receiving illicit funds' },
  { id: '04', title: 'Cash Out', desc: 'Moving to crypto/offshore' },
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

          <div className="mt-20 w-full max-w-5xl mx-auto relative animate-slide-up stagger-4">
            <p className="text-sm font-medium text-foreground-muted uppercase tracking-widest mb-8 text-center">
              Intercepting the Mule Fraud Kill Chain
            </p>
            <div className="relative">
              {/* Connecting Line */}
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -translate-y-1/2 hidden md:block"></div>
              <div className="absolute top-1/2 left-0 w-[60%] h-0.5 bg-gradient-to-r from-accent to-transparent -translate-y-1/2 hidden md:block"></div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {KILL_CHAIN_STEPS.map((step, index) => (
                  <div key={step.id} className="relative group h-full">
                    <div className="relative z-10 flex flex-col items-center bg-background p-4 rounded-xl border border-white/5 shadow-xl transition-transform hover:-translate-y-1 h-full">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-4 border ${index < 2 ? 'border-accent/50 text-accent bg-accent/10 shadow-[0_0_15px_rgba(0,255,170,0.3)]' : 'border-red-500/50 text-red-500 bg-red-500/10'}`}>
                        {step.id}
                      </div>
                      <h3 className="text-foreground font-semibold text-lg">{step.title}</h3>
                      <p className="text-foreground-muted text-sm text-center mt-1">{step.desc}</p>
                      
                      {index === 1 && (
                        <div className="absolute -top-3 -right-3 bg-accent text-background text-[10px] font-bold px-2 py-1 rounded-full animate-bounce shadow-[0_0_10px_rgba(0,255,170,0.8)]">
                          INTERCEPTED
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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