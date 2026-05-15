'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  type:  'customer' | 'quote' | 'order'
  id:    number
  title: string
  sub:   string
  href:  string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  customer: '👥',
  quote:    '📋',
  order:    '📄',
}

const TYPE_LABEL: Record<string, string> = {
  customer: 'Khách hàng',
  quote:    'Báo giá',
  order:    'Hợp đồng',
}

const HINTS = [
  { icon: '👥', text: 'Tìm theo tên hoặc số điện thoại khách hàng' },
  { icon: '📋', text: 'Tìm mã báo giá (VD: BG-2026-0042)' },
  { icon: '📄', text: 'Tìm mã hợp đồng / đơn thương mại' },
]

// ─── CommandBar ───────────────────────────────────────────────────────────────

export function CommandBar() {
  const [open,     setOpen]     = useState(false)
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef  = useRef<HTMLInputElement>(null)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const router = useRouter()

  // ── Open triggers: Ctrl/Cmd+K  +  custom event from sidebar ──────────────
  useEffect(() => {
    const onKeyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    const onEvent = () => setOpen(true)
    window.addEventListener('keydown', onKeyboard)
    window.addEventListener('commandbar:open', onEvent)
    return () => {
      window.removeEventListener('keydown', onKeyboard)
      window.removeEventListener('commandbar:open', onEvent)
    }
  }, [])

  // ── Focus input on open ───────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelected(0)
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  // ── Debounced search ──────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(timerRef.current)
    if (query.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    timerRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const json = await res.json()
        setResults(json.results ?? [])
        setSelected(0)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 280)
    return () => clearTimeout(timerRef.current)
  }, [query])

  // ── Keyboard navigation (when open) ──────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(s => Math.min(s + 1, results.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(s => Math.max(s - 1, 0))
        return
      }
      if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault()
        navigate(results[selected].href)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = useCallback((href: string) => {
    setOpen(false)
    router.push(href)
  }, [router])

  // ── Mobile FAB (only shown when closed) ──────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed bottom-[4.5rem] right-4 z-30 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-xl active:scale-95 transition-transform"
        aria-label="Tìm kiếm"
      >
        🔍
      </button>
    )
  }

  // ── Overlay ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <span className="text-gray-400 text-xl flex-shrink-0 leading-none">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm khách hàng, báo giá, hợp đồng..."
            className="flex-1 text-base text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {loading ? (
            <span className="text-xs text-gray-400 animate-pulse flex-shrink-0 font-mono">...</span>
          ) : (
            <kbd className="hidden sm:inline text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
              ESC
            </kbd>
          )}
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {results.map((r, i) => (
              <li key={`${r.type}-${r.id}`}>
                <button
                  onClick={() => navigate(r.href)}
                  onMouseEnter={() => setSelected(i)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    selected === i ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl flex-shrink-0 leading-none">{TYPE_ICON[r.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{r.title}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {TYPE_LABEL[r.type]}{r.sub ? ` · ${r.sub}` : ''}
                    </p>
                  </div>
                  {selected === i && (
                    <kbd className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                      ↵
                    </kbd>
                  )}
                </button>
              </li>
            ))}
          </ul>

        ) : query.length >= 2 && !loading ? (
          <div className="px-4 py-10 text-center">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm text-gray-500">
              Không tìm thấy kết quả cho{' '}
              <span className="font-semibold text-gray-700">&quot;{query}&quot;</span>
            </p>
          </div>

        ) : query.length === 0 ? (
          <div className="px-4 py-5">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Gợi ý</p>
            <div className="space-y-2.5">
              {HINTS.map(h => (
                <div key={h.text} className="flex items-center gap-2.5 text-sm text-gray-500">
                  <span className="text-base leading-none flex-shrink-0">{h.icon}</span>
                  <span>{h.text}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 border-t border-gray-50 flex items-center gap-4">
          {[
            { key: '↑↓', label: 'chọn' },
            { key: '↵',  label: 'mở'   },
            { key: 'Esc', label: 'đóng' },
          ].map(s => (
            <div key={s.key} className="flex items-center gap-1 text-xs text-gray-400">
              <kbd className="bg-gray-100 px-1 py-0.5 rounded font-mono">{s.key}</kbd>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
