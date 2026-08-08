import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="flex w-full items-center justify-between py-8">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold tracking-tight text-white">
          MULE<span className="font-normal opacity-80">RADAR</span>
        </span>
      </div>

      {/* Nav Links - Glass Pill */}
      <div className="hidden lg:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1 backdrop-blur-md">
        <a href="#" className="rounded-full px-6 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white">
          About
        </a>
        <a href="#" className="rounded-full px-6 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white">
          How it works
        </a>
        <a href="#" className="rounded-full px-6 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white">
          Features
        </a>
      </div>

      {/* CTA Button */}
      <div>
        <Link
          to="/dashboard"
          className="rounded-full bg-white px-8 py-3 text-sm font-bold text-black transition-transform hover:scale-105 active:scale-95"
        >
          GO TO CONSOLE
        </Link>
      </div>
    </nav>
  )
}

export default Navbar
