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

const DEFAULT_WIDTH = 380
const MIN_WIDTH = 280
const MAX_WIDTH = 600

function AIDrawer() {
  const { isOpen, closeDrawer } = useDrawer()
  const [accountId, setAccountId] = useState('')
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)

  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(DEFAULT_WIDTH)
  const isDraggingRef = useRef(false)

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
    dragStartWidthRef.current = width
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDrag)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }

  // Clamp the width if the window resizes so the drawer never exceeds the viewport
  useEffect(() => {
    const onResize = () => {
      setWidth((w) => Math.min(w, MAX_WIDTH))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Cleanup listeners on unmount
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

  // When the drawer is closed, its width animates to 0. Re-opening uses the
  // last set width (set by drag or by default).
  const visualWidth = isOpen ? width : 0

  return (
    <aside
      aria-hidden={!isOpen}
      className="relative flex h-full flex-col border-l border-border bg-background-subtle drawer-slide"
      style={{
        width: `${visualWidth}px`,
        minWidth: `${visualWidth}px`,
        opacity: isOpen ? 1 : 0,
        overflow: 'hidden',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      {/* Drag handle — 6px strip on the left edge */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize AI Assistant"
        onPointerDown={startDrag}
        className="absolute left-0 top-0 z-10 flex h-full w-[6px] cursor-col-resize flex-col items-center justify-center border-l border-foreground bg-transparent"
        style={{ touchAction: 'none' }}
      >
        <span className="pointer-events-none flex flex-col gap-1">
          <span className="block h-[2px] w-[2px] rounded-full bg-foreground-muted" />
          <span className="block h-[2px] w-[2px] rounded-full bg-foreground-muted" />
          <span className="block h-[2px] w-[2px] rounded-full bg-foreground-muted" />
        </span>
      </div>

      <div className="flex items-center justify-between border-b border-border px-6 py-5">
        <h2 className="text-lg font-bold text-foreground">AI Assistant</h2>
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Close AI Assistant"
          className="text-xl font-medium text-foreground hover:text-foreground-muted"
        >
          ✕
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-row items-stretch border-b border-border"
      >
        <input
          type="text"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="Enter Account ID..."
          className="flex-1 border border-r-0 border-foreground bg-background px-4 py-3 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none"
        />
        <button
          type="submit"
          className="border border-l border-foreground bg-background px-6 py-3 text-sm font-medium uppercase tracking-wider text-foreground hover:bg-white hover:text-background"
        >
          Summarize
        </button>
      </form>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <p className="flex items-center gap-1 text-sm text-foreground-muted">
            Generating summary
            <span className="ellipsis-dot">.</span>
            <span className="ellipsis-dot">.</span>
            <span className="ellipsis-dot">.</span>
          </p>
        )}
        {error && !loading && (
          <p className="text-sm text-[#ef4444]">{error}</p>
        )}
        {!loading && !error && summary && (
          <p className="whitespace-pre-line break-words text-sm text-foreground">
            {summary}
          </p>
        )}
        {!loading && !error && !summary && (
          <p className="text-sm text-foreground-muted">
            Enter an account ID to generate an AI summary.
          </p>
        )}
      </div>
    </aside>
  )
}

export default AIDrawer
