function TopBar() {
  return (
    <header className="flex w-full items-center justify-between border-b border-border px-4 py-4">
      <h2 className="text-base font-medium text-foreground">
        Fraud Operations Console
      </h2>

      <span className="inline-flex items-center border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
        ● LIVE
      </span>
    </header>
  )
}

export default TopBar
