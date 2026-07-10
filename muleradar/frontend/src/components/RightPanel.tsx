function RightPanel() {
  return (
    <aside className="h-full w-[260px] flex flex-col border-l border-border bg-background">
      <div className="border-b border-border px-6 py-6">
        <h2 className="text-lg font-bold text-foreground">AI Copilot</h2>
      </div>

      <div className="flex flex-col gap-4 p-6">
        <p className="text-sm text-foreground-muted">
          Chat interface coming soon
        </p>
      </div>
    </aside>
  )
}

export default RightPanel
