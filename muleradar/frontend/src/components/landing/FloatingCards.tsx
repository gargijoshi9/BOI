function FloatingCards() {
  return (
    <div className="relative mt-20 flex w-full flex-1 items-center justify-center lg:mt-0 perspective-1000">
      
      {/* Top Right Card */}
      <div 
        className="absolute top-10 right-0 z-20 h-64 w-96 rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-transform duration-700 hover:scale-105"
        style={{ transform: 'rotateX(15deg) rotateY(-20deg) rotateZ(5deg)' }}
      >
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold tracking-widest text-white/90">RISK SCORE</span>
            {/* Abstract radar icon lines */}
            <div className="h-6 w-8 rounded-full border border-white/30 bg-white/10 relative overflow-hidden">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/30" />
                <div className="absolute top-0 left-1/2 h-full w-px bg-white/30" />
            </div>
          </div>
          
          <div className="text-3xl font-mono tracking-widest text-white shadow-black drop-shadow-md mt-4">
            92.8 <span className="text-xl text-white/50">/ 100</span>
          </div>
          
          <div className="flex items-end justify-between mt-4">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-white/50">Alert Level</span>
              <span className="text-sm font-medium tracking-wide text-red-400">CRITICAL</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] uppercase tracking-wider text-white/50">Confidence</span>
              <span className="text-sm font-medium tracking-wide text-white">99%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Left Card */}
      <div 
        className="absolute bottom-0 left-0 z-30 h-64 w-96 rounded-3xl border border-white/20 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 p-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-transform duration-700 hover:scale-105"
        style={{ transform: 'rotateX(15deg) rotateY(-20deg) rotateZ(-5deg) translateZ(40px)' }}
      >
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold tracking-widest text-white/90">NETWORK</span>
            <div className="h-6 w-8 rounded-full border border-white/30 bg-white/10 relative overflow-hidden">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/30" />
                <div className="absolute top-0 left-1/2 h-full w-px bg-white/30" />
            </div>
          </div>
          
          <div className="text-2xl font-mono tracking-widest text-white shadow-black drop-shadow-md mt-4">
            3 MULES <span className="text-lg text-white/50">DETECTED</span>
          </div>
          
          <div className="flex items-end justify-between mt-4">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-white/50">Est. Exposure</span>
              <span className="text-sm font-medium tracking-wide text-white">₹ 5,65,000</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] uppercase tracking-wider text-white/50">Status</span>
              <span className="text-sm font-medium tracking-wide text-cyan-400">ACTIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Abstract Glowing Orb behind cards */}
      <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/20 blur-[100px]" />
      <div className="absolute top-1/3 left-1/3 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/20 blur-[100px]" />

    </div>
  )
}

export default FloatingCards
