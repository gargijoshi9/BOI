const NAV_ITEMS = ['Dashboard', 'Accounts', 'Network', 'Copilot'] as const

function Sidebar() {
  return (
    <aside className="h-full w-[220px] flex flex-col border-r border-border bg-background">
      <div className="border-b border-border px-6 py-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          MuleRadar
        </h1>
      </div>

      <nav className="flex flex-col">
        {NAV_ITEMS.map((item) => {
          const isActive = item === 'Dashboard'
          return (
            <a
              key={item}
              href="#"
              className={[
                'block w-full px-6 py-4 text-sm text-foreground',
                'border-l-2',
                isActive
                  ? 'border-l-border bg-white/5'
                  : 'border-l-transparent',
              ].join(' ')}
            >
              {item}
            </a>
          )
        })}
      </nav>
    </aside>
  )
}

export default Sidebar
