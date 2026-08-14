export default function WhyUsSection() {
  return (
    <section id="why-us" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <div className="mx-auto max-w-2xl lg:text-center animate-slide-up">
          <h2 className="text-base font-semibold leading-7 text-accent uppercase tracking-wider">Why MuleRadar</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
            Unmatched Speed, Accuracy & Transparency
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="card border-red-500/30 bg-background-subtle shadow-[0_0_10px_rgba(239,68,68,0.3),_0_0_30px_rgba(239,68,68,0.15)] relative overflow-hidden">
              <h3 className="text-lg font-bold text-foreground-muted mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Legacy Systems
              </h3>
              <ul className="space-y-4">
                {[
                  'Post-transaction analysis and delayed alerts',
                  'Missingness treated as data error, losing signal',
                  'Single-account evaluation ignores mule rings',
                  'Black-box decisions violate compliance'
                ].map((text, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground-muted items-start">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400/50 flex-shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card border-accent/30 bg-background-subtle shadow-glow-teal relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg className="w-24 h-24 text-accent" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2 relative z-10">
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                MuleRadar
              </h3>
              <ul className="space-y-4 relative z-10">
                {[
                  'Pre-transaction continuous detection',
                  'Missingness intelligence encodes absence as fraud signal',
                  'Graph Neural Networks catch circular transactions',
                  'SHAP-powered AI Copilot for regulatory compliance'
                ].map((text, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground items-start font-medium">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-accent/[0.02] rounded-full blur-[100px] pointer-events-none" />
    </section>
  )
}
