import { Link } from 'react-router-dom'

const SOLUTIONS = [
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
      </svg>
    ),
    title: 'Account Opening Protection',
    description: 'Analyzes every account opening interaction to distinguish genuine applicants from stolen identities, synthetic accounts, and mule activity.',
    href: '#account-opening',
  },
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'Mule Account Detection',
    description: 'Identifies mule activity days or weeks before traditional controls by analyzing behavioral patterns, device intelligence, and network associations.',
    href: '#mule-detection',
  },
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'Real-Time Risk Scoring',
    description: 'Sub-500ms risk assessment using ML ensemble models across 3,000+ behavioral, device, and transactional signals.',
    href: '#risk-scoring',
  },
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Network Intelligence',
    description: 'Graph-based analysis exposing hidden fraud rings, shared device fingerprints, and coordinated mule networks across institutions.',
    href: '#network-intel',
  },
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'SHAP Explainability',
    description: 'Transparent AI decisions with feature-level attribution — every risk score comes with clear, actionable reasoning for investigators.',
    href: '#shap',
  },
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
    title: 'Continuous Monitoring',
    description: '24/7 behavioral surveillance across the entire customer journey — from onboarding to every transaction, login, and interaction.',
    href: '#monitoring',
  },
] as const

function FloatingCards() {
  return (
    <section className="relative py-20 lg:py-28 animate-fade-in" aria-labelledby="solutions-heading">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 id="solutions-heading" className="text-display-md font-bold text-foreground tracking-tight animate-slide-up">
            Comprehensive Fraud Defense
          </h2>
          <p className="mt-4 text-body-lg text-foreground-muted animate-slide-up stagger-1">
            MuleRadar unifies behavioral intelligence, device analytics, and network forensics into a single platform
            that detects mule accounts across the entire customer lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SOLUTIONS.map((solution, i) => (
            <article
              key={solution.title}
              className="card card-hover group animate-slide-up"
              style={{ animationDelay: `${100 + i * 100}ms` }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent mb-5 group-hover:bg-accent/20 group-hover:shadow-glow-teal transition-all duration-300">
                {solution.icon}
              </div>
              <h3 className="text-heading-md font-bold text-foreground mb-3 group-hover:text-accent transition-colors duration-200">
                {solution.title}
              </h3>
              <p className="text-body-sm text-foreground-muted mb-6 line-clamp-3">
                {solution.description}
              </p>
              <a
                href={solution.href}
                className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-accent hover:text-accent-hover transition-colors"
              >
                Learn more
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </a>
            </article>
          ))}
        </div>

        <div className="mt-16 text-center animate-slide-up stagger-6">
          <Link to="/dashboard" className="btn-primary inline-flex">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Explore the Console
          </Link>
        </div>
      </div>

      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 right-1/4 h-96 w-96 rounded-full bg-accent/3 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-teal-500/3 blur-[120px]" />
      </div>
    </section>
  )
}

export default FloatingCards