const PANELS = [
  { label: 'Risk Score Panel' },
  { label: 'Kill Chain Stage' },
  { label: 'Damage Forecast' },
] as const

function MainGrid() {
  return (
    <section className="flex h-full flex-1 flex-row gap-4 p-6">
      {PANELS.map((panel) => (
        <div
          key={panel.label}
          className="flex h-[180px] flex-1 flex-col items-center justify-center border border-border p-6"
        >
          <h3 className="text-sm font-medium text-foreground">
            {panel.label}
          </h3>
          <p className="mt-2 text-xs text-foreground-muted">
            Data loading...
          </p>
        </div>
      ))}
    </section>
  )
}

export default MainGrid
