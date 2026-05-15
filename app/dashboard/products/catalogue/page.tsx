'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const fmtMoney = (n: number) => n > 0 ? n.toLocaleString('vi-VN') + '₫' : '—'

function CatalogueContent() {
  const searchParams = useSearchParams()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ids = searchParams.get('ids')
    const tier = searchParams.get('tier') ?? 'niem_yet'
    const nhom = searchParams.get('nhom')

    fetch('/api/products/catalogue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_ids: ids ? ids.split(',').map(Number).filter(Boolean) : [],
        price_tier: tier,
        nhom_sp: nhom || undefined,
        include_mo_ta: true,
      }),
    })
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [searchParams])

  const today = new Date().toLocaleDateString('vi-VN')

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <span className="crm-spinner" />
    </div>
  )

  return (
    <div className="min-h-screen bg-white p-6 max-w-4xl mx-auto">
      {/* Print button — ẩn khi in */}
      <div className="print:hidden mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Catalogue sản phẩm ({items.length} SP)</h1>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold"
        >
          🖨️ In / Xuất PDF
        </button>
      </div>

      {/* Header */}
      <div className="border-b-2 border-blue-600 pb-4 mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">CÔNG TY TNHH NƯỚC SẠCH ABC</p>
        <h2 className="text-2xl font-bold text-blue-800">Bảng giá sản phẩm</h2>
        <p className="text-sm text-gray-500 mt-1">Ngày: {today} · Tổng cộng {items.length} sản phẩm</p>
      </div>

      {/* Product grid */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2">
          <span className="text-4xl">📦</span>
          <p className="text-gray-500 text-sm">Không có sản phẩm nào để hiển thị</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {items.map((item: any) => (
            <div key={item.id} className="border border-gray-200 rounded-lg p-3 break-inside-avoid">
              {item.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url}
                  alt=""
                  className="w-full h-32 object-contain mb-2 bg-gray-50 rounded"
                />
              )}
              <p className="font-bold text-sm text-gray-800">{item.ten_sp}</p>
              <p className="text-xs text-gray-400">
                {item.ma_sp}{item.phan_loai ? ` · ${item.phan_loai}` : ''}
              </p>
              {item.gia !== null && item.gia !== undefined && item.gia > 0 && (
                <p className="text-base font-bold text-blue-700 mt-1">{fmtMoney(item.gia)}</p>
              )}
              {item.mo_ta && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.mo_ta}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-200 mt-8 pt-4 text-xs text-gray-400 text-center">
        <p>Giá trên chỉ có giá trị tham khảo · Liên hệ để được báo giá chính xác</p>
        <p className="mt-1">Giá hiệu lực đến: {today} · Hotline: 1900 xxxx</p>
      </div>

      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { font-size: 12px; }
          .break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

export default function CataloguePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <span className="crm-spinner" />
      </div>
    }>
      <CatalogueContent />
    </Suspense>
  )
}
