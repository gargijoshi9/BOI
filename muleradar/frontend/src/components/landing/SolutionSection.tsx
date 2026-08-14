export default function SolutionSection() {
  return (
    <section id="solution" className="relative py-24 sm:py-32 overflow-hidden bg-[#112240]/30 border-y border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 gap-y-16 lg:grid-cols-2 lg:gap-x-16 lg:items-center">
          <div className="animate-slide-up">
            <h2 className="text-base font-semibold leading-7 text-accent uppercase tracking-wider">Our Solution</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
              End-to-End AI Fraud Intelligence
            </p>
            <p className="mt-6 text-lg leading-8 text-foreground-muted">
              MuleRadar is not just a classification model. It combines behavioral analysis, explainable AI, graph intelligence, and GenAI to provide real-time, audit-ready fraud detection.
            </p>
            <ul className="mt-10 space-y-6 text-foreground-muted">
              {[
                'Behavioral DNA Fingerprinting (Pass-through ratios, dormancy flags)',
                'Intelligent Data Refinement (Missingness as a fraud signal)',
                'Hybrid ML Engine (XGBoost, LightGBM + Isolation Forest)',
                'NetworkX Graph Intelligence (Mule Ring & Layering Detection)',
                'Fraud Kill Chain Analysis & Financial Damage Forecasting'
              ].map((item, i) => (
                <li key={i} className="flex gap-x-3 items-center text-sm font-medium">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20">
                    <svg className="h-4 w-4 text-accent" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative animate-slide-up stagger-2">
            <div className="absolute -inset-4 bg-gradient-to-r from-accent/20 to-teal-500/20 blur-xl opacity-50 rounded-2xl"></div>
            <div className="relative bg-background-card border border-border rounded-2xl p-6 shadow-card-hover overflow-hidden">
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground-muted">Data Refinement Engine (Missingness Flags)</span>
                  <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                </div>
                <div className="flex justify-center text-border">
                  <svg className="w-6 h-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-between shadow-glow-teal">
                  <span className="text-sm font-medium text-accent">Domain-Driven Feature Engineering (50 variables)</span>
                  <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex justify-center text-border">
                  <svg className="w-6 h-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Hybrid ML Engine (Supervised + Unsupervised)</span>
                  <span className="px-2 py-1 bg-red-500/20 border border-red-500/50 text-red-400 text-xs font-bold rounded animate-pulse shadow-glow-red">RISK SCORE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
