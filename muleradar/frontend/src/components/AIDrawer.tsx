import {
  FormEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { fetchAIAssistantSummary } from '../api/client'
import { useDrawer } from '../context/DrawerContext'

const DEFAULT_WIDTH = 400
const MIN_WIDTH = 300
const MAX_WIDTH = 640

function getPointStyle(text: string) {
  const t = text.toLowerCase()
  if (t.includes('critical') || t.includes('high risk') || t.includes('fraud') || t.includes('scam') || t.includes('suspicious') || t.includes('flagged')) {
    return { emoji: '🚨', className: 'border-risk-critical/30 hover:border-risk-critical/50 hover:bg-risk-critical/10', textClass: 'text-risk-critical' }
  }
  if (t.includes('network') || t.includes('connection') || t.includes('ring') || t.includes('cluster') || t.includes('node') || t.includes('graph')) {
    return { emoji: '🔗', className: 'border-accent/30 hover:border-accent/50 hover:bg-accent/10', textClass: 'text-accent' }
  }
  if (t.includes('transaction') || t.includes('money') || t.includes('amount') || t.includes('transfer') || t.includes('layering') || t.includes('exposure') || t.includes('fund')) {
    return { emoji: '💸', className: 'border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/10', textClass: 'text-purple-400' }
  }
  if (t.includes('safe') || t.includes('normal') || t.includes('low risk') || t.includes('clean') || t.includes('legitimate')) {
    return { emoji: '✅', className: 'border-risk-low/30 hover:border-risk-low/50 hover:bg-risk-low/10', textClass: 'text-risk-low' }
  }
  if (t.includes('model') || t.includes('shap') || t.includes('feature') || t.includes('ai') || t.includes('score')) {
    return { emoji: '🤖', className: 'border-blue-500/30 hover:border-blue-500/50 hover:bg-blue-500/10', textClass: 'text-blue-400' }
  }
  return { emoji: '💡', className: 'border-border hover:border-border-light hover:bg-background-card', textClass: 'text-foreground-muted' }
}

function AIDrawer() {
  const { isOpen, closeDrawer, initialAccountId } = useDrawer()
  const [accountId, setAccountId] = useState('')
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)

  const dragStartXRef = useRef(0)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    if (initialAccountId && initialAccountId !== accountId) {
      setAccountId(initialAccountId)
      setSummary(null)
      setError(null)
      setLoading(true)
      fetchAIAssistantSummary(initialAccountId)
        .then((result) => {
          setSummary(result)
          setLoading(false)
        })
        .catch(() => {
          setError('Could not generate summary. Try again.')
          setLoading(false)
        })
    }
  }, [initialAccountId])

  const handlePointerMove = useCallback((e: globalThis.PointerEvent) => {
    if (!isDraggingRef.current) return
    const newWidth = Math.max(
      MIN_WIDTH,
      Math.min(MAX_WIDTH, window.innerWidth - e.clientX),
    )
    setWidth(newWidth)
  }, [])

  const stopDrag = useCallback(() => {
    isDraggingRef.current = false
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', stopDrag)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [handlePointerMove])

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    isDraggingRef.current = true
    dragStartXRef.current = e.clientX
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDrag)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }

  useEffect(() => {
    const onResize = () => {
      setWidth((w) => Math.min(w, MAX_WIDTH))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDrag)
    }
  }, [handlePointerMove, stopDrag])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const id = accountId.trim()
    if (!id) return
    setLoading(true)
    setError(null)
    setSummary(null)
    try {
      const result = await fetchAIAssistantSummary(id)
      setSummary(result)
    } catch {
      setError('Could not generate summary. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const visualWidth = isOpen ? width : 0

  return (
    <aside
      aria-hidden={!isOpen}
      className="relative flex h-full flex-col drawer-slide"
      style={{
        width: `${visualWidth}px`,
        minWidth: `${visualWidth}px`,
        opacity: isOpen ? 1 : 0,
        overflow: 'hidden',
        pointerEvents: isOpen ? 'auto' : 'none',
        background: 'rgba(10, 22, 40, 0.98)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(30, 58, 95, 0.8)',
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize AI Assistant"
        onPointerDown={startDrag}
        className="absolute left-0 top-0 z-10 flex h-full w-[6px] cursor-col-resize flex-col items-center justify-center"
        style={{ touchAction: 'none' }}
      >
        <span className="pointer-events-none flex flex-col gap-1">
          <span className="block h-[2px] w-[2px] rounded-full bg-foreground-muted" />
          <span className="block h-[2px] w-[2px] rounded-full bg-foreground-muted" />
          <span className="block h-[2px] w-[2px] rounded-full bg-foreground-muted" />
        </span>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <h2 className="text-heading-sm font-semibold text-accent">
          AI Assistant
        </h2>
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Close AI Assistant"
          className="p-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-card transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-row items-stretch gap-2 p-4 border-b border-border/50"
      >
        <input
          type="text"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="Enter Account ID..."
          className="input-field flex-1"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-primary whitespace-nowrap"
        >
          {loading ? 'Generating...' : 'Summarize'}
        </button>
      </form>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="glass flex items-center justify-center p-8 border border-accent/20">
            <p className="text-body-sm text-accent flex items-center gap-1">
              Generating summary
              <span className="ellipsis-dot">.</span>
              <span className="ellipsis-dot">.</span>
              <span className="ellipsis-dot">.</span>
            </p>
          </div>
        )}
        {error && !loading && (
          <div className="glass p-4 border border-risk-critical/30 bg-risk-critical/5">
            <p className="text-body-sm text-risk-critical">{error}</p>
          </div>
        )}
        {!loading && !error && summary && (
          <div className="space-y-3">
            {(summary.split('\n').filter(p => p.trim().length > 0).length > 1
              ? summary.split('\n')
              : summary.split(/(?<=\.)\s+/))
              .map(p => p.trim().replace(/^[-*•]\s*/, ''))
              .filter(p => p.length > 0)
              .map((point, idx) => {
                const style = getPointStyle(point)
                return (
                  <div key={idx} className={`glass p-4 rounded-xl border transition-all ${style.className}`}>
                    <div className="flex gap-3 items-start">
                      <div className="mt-0.5 flex-shrink-0 text-base">
                        {style.emoji}
                      </div>
                      <p className="text-body-sm text-foreground leading-relaxed m-0">
                        {point}
                      </p>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
        {!loading && !error && !summary && (
          <div className="glass p-8 text-center border border-border/50">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center bg-accent/10">
              <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="text-heading-sm font-semibold text-foreground mb-2">Ready to Analyze</h3>
            <p className="text-body-sm text-foreground-muted">Enter an account ID to generate an AI-powered fraud investigation summary.</p>
          </div>
        )}
      </div>
    </aside>
  )
}

export default AIDrawer