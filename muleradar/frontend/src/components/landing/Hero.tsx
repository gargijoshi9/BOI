import { Link } from 'react-router-dom'

function Hero() {
  return (
    <div className="flex w-full max-w-2xl flex-col pt-12 lg:pt-24 lg:pr-12">
      {/* Abstract decorative dots pattern, resembling the top left of the reference image */}
      <div className="mb-12 grid grid-cols-6 gap-3 opacity-20 w-fit">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="h-1 w-1 rounded-full bg-white" />
        ))}
      </div>

      <h1 className="text-5xl font-black uppercase tracking-tight text-white leading-[1.1] md:text-7xl">
        Your Fraud Defense.<br />
        <span className="opacity-90">Too Fast Too Safe!</span>
      </h1>

      <div className="mt-8 flex max-w-lg flex-col gap-8 text-sm font-medium text-white/60 sm:flex-row sm:gap-12 leading-relaxed">
        <p className="flex-1">
          Real-time transaction monitoring and autonomous network analysis
          is carried out directly in the console.
        </p>
        <p className="flex-1">
          A dedicated AI copilot specially designed for secure investigation
          on the internet. It's powerful!
        </p>
      </div>

      <div className="mt-12">
        <Link
          to="/dashboard"
          className="inline-block rounded-full bg-white px-10 py-4 text-sm font-bold text-black transition-transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
        >
          GET STARTED
        </Link>
      </div>


    </div>
  )
}

export default Hero
