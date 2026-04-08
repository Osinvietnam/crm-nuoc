'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuoteItem {
  id:       string   // local id (không gửi lên Lark)
  ten_sp:   string
  so_luong: number
  don_gia:  number
}

export function itemsToLarkFields(items: QuoteItem[]): { san_pham: string; tong_gia_tri: number } {
  const san_pham    = items.map(i => `${i.ten_sp}${i.so_luong > 1 ? ` (${i.so_luong}x)` : ''}`).join(', ')
  const tong_gia_tri = items.reduce((sum, i) => sum + i.so_luong * i.don_gia, 0)
  return { san_pham, tong_gia_tri }
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

const fmtMoney = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '0₫'

// ─── Draft persistence ────────────────────────────────────────────────────────

function loadDraft(key: string): QuoteItem[] {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as QuoteItem[]) : []
  } catch { return [] }
}

function saveDraft(key: string, items: QuoteItem[]) {
  try { sessionStorage.setItem(key, JSON.stringify(items)) } catch { /* ignore */ }
}

function clearDraft(key: string) {
  try { sessionStorage.removeItem(key) } catch { /* ignore */ }
}

// ─── Single Item Row ─────────────────────────────────────────────────────────

function ItemRow({ item, onChange, onRemove }: {
  item:     QuoteItem
  onChange: (id: string, field: keyof QuoteItem, value: string | number) => void
  onRemove: (id: string) => void
}) {
  const subtotal = item.so_luong * item.don_gia

  return (
    <div className="bg-gray-50 rounded-xl p-3 space-y-2">
      {/* Product name + remove */}
      <div className="flex items-center gap-2">
        <input
          value={item.ten_sp}
          onChange={e => onChange(item.id, 'ten_sp', e.target.value)}
          placeholder="Tên sản phẩm"
          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={() => onRemove(item.id)}
          className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Qty × Price = Subtotal */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
          <button
            onClick={() => onChange(item.id, 'so_luong', Math.max(1, item.so_luong - 1))}
            className="w-5 h-5 flex items-center justify-center text-gray-500 text-base leading-none"
          >−</button>
          <span className="text-sm font-semibold text-gray-700 w-5 text-center">{item.so_luong}</span>
          <button
            onClick={() => onChange(item.id, 'so_luong', item.so_luong + 1)}
            className="w-5 h-5 flex items-center justify-center text-gray-500 text-base leading-none"
          >+</button>
        </div>

        <span className="text-gray-300 text-sm">×</span>

        <input
          type="number"
          value={item.don_gia || ''}
          onChange={e => onChange(item.id, 'don_gia', Number(e.target.value) || 0)}
          placeholder="Đơn giá"
          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <span className="text-xs font-semibold text-blue-600 flex-shrink-0 min-w-[72px] text-right">
          {fmtMoney(subtotal)}
        </span>
      </div>
    </div>
  )
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

interface Props {
  draftKey:    string                              // sessionStorage key, unique per form
  onAddFromPicker?: () => void                    // mở ProductPicker bên ngoài
  pendingProduct?: { ten_sp: string; don_gia: number } | null  // product từ picker truyền vào
  onPendingConsumed?: () => void                  // báo đã consume pending product
}

export function QuoteItemsEditor({ draftKey, onAddFromPicker, pendingProduct, onPendingConsumed }: Props) {
  const [items, setItems] = useState<QuoteItem[]>(() => loadDraft(draftKey))

  // Persist on change
  useEffect(() => { saveDraft(draftKey, items) }, [draftKey, items])

  // Consume product từ picker (gọi từ bên ngoài)
  useEffect(() => {
    if (!pendingProduct) return
    setItems(prev => {
      // Nếu sản phẩm đã có → tăng số lượng
      const existing = prev.find(i => i.ten_sp === pendingProduct.ten_sp)
      if (existing) {
        return prev.map(i => i.id === existing.id ? { ...i, so_luong: i.so_luong + 1 } : i)
      }
      return [...prev, { id: uid(), ten_sp: pendingProduct.ten_sp, so_luong: 1, don_gia: pendingProduct.don_gia }]
    })
    onPendingConsumed?.()
  }, [pendingProduct, onPendingConsumed])

  const addBlankItem = () =>
    setItems(prev => [...prev, { id: uid(), ten_sp: '', so_luong: 1, don_gia: 0 }])

  const removeItem = useCallback((id: string) =>
    setItems(prev => prev.filter(i => i.id !== id)), [])

  const changeItem = useCallback((id: string, field: keyof QuoteItem, value: string | number) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i)), [])

  const total = items.reduce((s, i) => s + i.so_luong * i.don_gia, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-gray-500">SẢN PHẨM ĐỀ XUẤT</label>
        {items.length > 0 && (
          <button onClick={() => { setItems([]); clearDraft(draftKey) }}
            className="text-xs text-red-400 font-medium">
            Xoá tất cả
          </button>
        )}
      </div>

      {/* Item list */}
      {items.map(item => (
        <ItemRow key={item.id} item={item} onChange={changeItem} onRemove={removeItem} />
      ))}

      {/* Add buttons */}
      <div className="flex gap-2">
        {onAddFromPicker && (
          <button onClick={onAddFromPicker}
            className="flex-1 border-2 border-dashed border-blue-200 rounded-xl py-2.5 text-xs text-blue-600 font-semibold">
            + Chọn từ danh mục
          </button>
        )}
        <button onClick={addBlankItem}
          className="flex-1 border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-xs text-gray-500 font-semibold">
          + Nhập thủ công
        </button>
      </div>

      {/* Total */}
      {items.length > 0 && (
        <div className="flex justify-between items-center pt-1 border-t border-gray-100 mt-1">
          <span className="text-xs text-gray-400">{items.length} sản phẩm</span>
          <span className="text-sm font-bold text-gray-800">{fmtMoney(total)}</span>
        </div>
      )}
    </div>
  )
}

// ─── Hook tiện ích ────────────────────────────────────────────────────────────

export function useQuoteItems(draftKey: string) {
  const [items, setItems] = useState<QuoteItem[]>(() => loadDraft(draftKey))
  useEffect(() => { saveDraft(draftKey, items) }, [draftKey, items])

  const addItem = useCallback((product: { ten_sp: string; don_gia: number }) => {
    setItems(prev => {
      const existing = prev.find(i => i.ten_sp === product.ten_sp)
      if (existing) return prev.map(i => i.id === existing.id ? { ...i, so_luong: i.so_luong + 1 } : i)
      return [...prev, { id: uid(), ten_sp: product.ten_sp, so_luong: 1, don_gia: product.don_gia }]
    })
  }, [])

  const addBlank = useCallback(() =>
    setItems(prev => [...prev, { id: uid(), ten_sp: '', so_luong: 1, don_gia: 0 }]), [])

  const removeItem = useCallback((id: string) =>
    setItems(prev => prev.filter(i => i.id !== id)), [])

  const changeItem = useCallback((id: string, field: keyof QuoteItem, value: string | number) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i)), [])

  const clear = useCallback(() => { setItems([]); clearDraft(draftKey) }, [draftKey])

  const total = items.reduce((s, i) => s + i.so_luong * i.don_gia, 0)

  return { items, total, addItem, addBlank, removeItem, changeItem, clear }
}
