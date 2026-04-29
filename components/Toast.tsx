'use client'

import { createContext, useCallback, useContext, useState } from 'react'

interface ToastItem { id: number; msg: string; isError: boolean }

const ToastCtx = createContext<(msg: string, isError?: boolean) => void>(() => {})

export function useToast() {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const show = useCallback((msg: string, isError = false) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, isError }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="fixed bottom-6 left-0 right-0 flex flex-col items-center gap-2 z-[9999] pointer-events-none px-4">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white text-center max-w-sm w-full ${
              t.isError ? 'bg-red-500' : 'bg-gray-800'
            }`}
          >
            {t.isError ? '✕ ' : '✓ '}{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
