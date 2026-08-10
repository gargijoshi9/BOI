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
  const { isOpen, closeDrawer, initialAccountId } = useDrawer()
  const [accountId, setAccountId] = useState('')
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)

  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(DEFAULT_WIDTH)
  const isDraggingRef = useRef(false)

  // Auto-fetch summary when initialAccountId changes
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
      className="relative flex h-full flex-col ai-drawer-edge-glow drawer-slide"
      style={{
        width: `${visualWidth}px`,
        minWidth: `${visualWidth}px`,
        opacity: isOpen ? 1 : 0,
        overflow: 'hidden',
        pointerEvents: isOpen ? 'auto' : 'none',
        background: 'rgba(2, 2, 12, 0.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(34, 211, 238, 0.15)',
      }}
    >
      {/* Drag handle — 6px strip on the left edge. Hover state is
          handled via .drawer-drag-handle in index.css (cyan tint +
          subtle glow on hover, cursor stays col-resize). */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize AI Assistant"
        onPointerDown={startDrag}
        className="drawer-drag-handle absolute left-0 top-0 z-10 flex h-full w-[6px] cursor-col-resize flex-col items-center justify-center"
        style={{ touchAction: 'none' }}
      >
        <span className="pointer-events-none flex flex-col gap-1">
          <span className="block h-[2px] w-[2px] rounded-full bg-[#cbd5e1]" />
          <span className="block h-[2px] w-[2px] rounded-full bg-[#cbd5e1]" />
          <span className="block h-[2px] w-[2px] rounded-full bg-[#cbd5e1]" />
        </span>
      </div>

      <div
        className="flex items-center justify-between px-6 py-5"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <h2
          className="text-lg"
          style={{ color: '#22d3ee', fontWeight: 700 }}
        >
          AI Assistant
        </h2>
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Close AI Assistant"
          className="text-xl font-medium"
          style={{
            color: '#cbd5e1',
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#f8fafc'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#cbd5e1'
          }}
        >
          ✕
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-row items-stretch"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <input
          type="text"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="Enter Account ID..."
          className="flex-1 px-4 py-3 text-sm focus:outline-none"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#f8fafc',
            transition: 'border-color 200ms ease, box-shadow 200ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.4)'
            e.currentTarget.style.boxShadow =
              '0 0 0 3px rgba(34, 211, 238, 0.08)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 text-sm font-medium uppercase tracking-wider"
          style={{
            background: loading ? 'rgba(34, 211, 238, 0.05)' : 'rgba(34, 211, 238, 0.1)',
            border: loading ? '1px solid rgba(34, 211, 238, 0.2)' : '1px solid rgba(34, 211, 238, 0.4)',
            color: loading ? '#22d3ee80' : '#22d3ee',
            transition: 'all 200ms ease',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (loading) return
            e.currentTarget.style.background = 'rgba(34, 211, 238, 0.2)'
            e.currentTarget.style.boxShadow =
              '0 0 20px rgba(34, 211, 238, 0.2)'
          }}
          onMouseLeave={(e) => {
            if (loading) return
            e.currentTarget.style.background = 'rgba(34, 211, 238, 0.1)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {loading ? 'Generating...' : 'Summarize'}
        </button>
      </form>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <p
            className="flex items-center gap-1 text-sm"
            style={{ color: '#22d3ee' }}
          >
            Generating summary
            <span className="ellipsis-dot">.</span>
            <span className="ellipsis-dot">.</span>
            <span className="ellipsis-dot">.</span>
          </p>
        )}
        {error && !loading && (
          <p className="text-sm" style={{ color: '#ef4444' }}>
            {error}
          </p>
        )}
        {!loading && !error && summary && (
          <p
            className="whitespace-pre-line break-words text-sm"
            style={{ color: '#cbd5e1', lineHeight: 1.7 }}
          >
            {summary}
          </p>
        )}
        {!loading && !error && !summary && (
          <p className="text-sm" style={{ color: '#cbd5e1' }}>
            Enter an account ID to generate an AI summary.
          </p>
        )}
      </div>
    </aside>
  )
}

export default AIDrawer
