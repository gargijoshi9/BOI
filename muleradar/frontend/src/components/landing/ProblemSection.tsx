export default function ProblemSection() {
  return (
    <section id="problem" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <div className="mx-auto max-w-2xl lg:text-center animate-slide-up">
          <h2 className="text-base font-semibold leading-7 text-accent uppercase tracking-wider">The Problem</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
            Detecting money mules is <span className="text-red-400">mathematically hostile</span>.
          </p>
          <p className="mt-6 text-lg leading-8 text-foreground-muted">
            With only 0.89% of accounts being confirmed mules, naive accuracy models fail. Fraud syndicates evolve, regulations demand explainability, and disconnected banking teams miss critical Suspicious Transaction Reports (STRs).
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
            {[
              {
                title: 'The Accuracy Trap',
                description: 'A model classifying every customer as "legitimate" hits 99.1% accuracy but is entirely useless for stopping actual money mules.',
                icon: (
                  <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                )
              },
              {
                title: 'The Concept Drift',
                description: 'Syndicates continuously evolve their tactics—using smurfing, layering, and synthetic identities—to evade static, rules-based detection.',
                icon: (
                  <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )
              },
              {
                title: 'The Compliance Burden',
                description: 'Regulators reject "black box" decisions. Freezing an account without mathematical justification violates consumer trust and banking rules.',
                icon: (
                  <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                )
              },
              {
                title: 'Siloed Banking Teams',
                description: 'Fraud detection and AML teams rarely coordinate. Closed mule accounts are often not reported to FIU-IND, letting the same mules open new accounts.',
                icon: (
                  <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                )
              }
            ].map((feature) => (
              <div key={feature.title} className="flex flex-col items-start card card-hover">
                <div className="rounded-lg bg-white/5 p-3 ring-1 ring-white/10 mb-6">
                  {feature.icon}
                </div>
                <dt className="text-xl font-bold leading-7 text-foreground">
                  {feature.title}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-foreground-muted">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[120px] pointer-events-none" />
    </section>
  )
}
