'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { CONTRACT_STATUS_COLORS } from '@/lib/lark/tables'
import type { Contract } from '@/app/api/lark/orders/route'

const downloadContractPDF = async (contract: Contract) => {
  const [{ downloadContractPDF: dl }, company] = await Promise.all([
    import('@/components/ContractPDF'),
    fetch('/api/admin/settings').then(r => r.json()).then(d => d.data ?? {}),
  ])
  await dl(contract, company)
}

const fmtMoney = (n: number) => n ? n.toLocaleString('vi-VN') + '₫' : '—'
const fmtDate  = (ms: number | null) => ms
  ? new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value || value === 'undefined' || value === 'null' || value === '0₫') return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  )
}

const CONTRACT_STATUSES = [
  'Đã ký - Chờ TT đợt 1',
  'Đã ký - Chờ TT đợt 2',
  'Đã ký - Chờ TT đợt 3',
  'Đang thi công',
  'Chờ nghiệm thu',
  'Hoàn thành',
  'Hủy hợp đồng',
]

export default function ContractDetailPage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [contract, setContract]     = useState<Contract | null>(null)
  const [loading, setLoading]       = useState(true)
  const [showStatus, setShowStatus] = useState(false)
  const [updating, setUpdating]     = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [exportingPDF, setExportingPDF] = useState(false)
  const [deliveryPhotos, setDeliveryPhotos] = useState<string[]>([])
  const [deliveryConfirmed, setDeliveryConfirmed] = useState<string | null>(null)
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [uploadingDelivery, setUploadingDelivery] = useState(false)
  const [showDeliveryForm, setShowDeliveryForm] = useState(false)
  const [myRole, setMyRole] = useState('')
  const [warranties,      setWarranties]      = useState<any[]>([])
  const [wTickets,        setWTickets]        = useState<any[]>([])
  const [warrantyReady,   setWarrantyReady]   = useState<boolean | null>(null)
  const [showAddTicket,   setShowAddTicket]   = useState(false)
  const [ticketTitle,   setTicketTitle]   = useState('')
  const [ticketMoTa,    setTicketMoTa]    = useState('')
  const [ticketPriority,setTicketPriority]= useState('Bình thường')
  const [savingTicket,  setSavingTicket]  = useState(false)
  const deliveryFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/lark/orders/contract/${id}`)
      .then(r => r.json())
      .then(d => {
        setContract(d.data)
        setDeliveryPhotos(d.data?.delivery_photos ?? [])
        setDeliveryConfirmed(d.data?.delivery_confirmed_at ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    fetch('/api/auth/me').then(r => r.json()).then(d => setMyRole(d?.role ?? '')).catch(() => {})
    Promise.all([
      fetch(`/api/warranties?order_id=${id}`),
      fetch(`/api/warranty-tickets?order_id=${id}`),
    ]).then(async ([wRes, tRes]) => {
      if (wRes.ok) {
        const wd = await wRes.json()
        setWarranties(wd.data ?? [])
      }
      if (tRes.ok) {
        const td = await tRes.json()
        setWTickets(td.data ?? [])
      }
      setWarrantyReady(wRes.ok && tRes.ok)
    }).catch(() => setWarrantyReady(false))
  }, [id])

  const confirmDelivery = async (file?: File) => {
    setUploadingDelivery(true)
    try {
      const fd = new FormData()
      if (file) fd.append('file', file)
      if (deliveryNotes) fd.append('notes', deliveryNotes)
      const res  = await fetch(`/api/lark/orders/contract/${id}/delivery`, { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success) {
        setDeliveryConfirmed(new Date().toISOString())
        if (json.urls?.length) setDeliveryPhotos(prev => [...prev, ...json.urls])
        setDeliveryNotes('')
        setShowDeliveryForm(false)
        setSuccessMsg('Đã xác nhận giao hàng')
        setTimeout(() => setSuccessMsg(''), 2500)
      }
    } finally {
      setUploadingDelivery(false)
    }
  }

  const updateStatus = async (status: string) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/lark/orders/contract/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trang_thai: status }),
      })
      if (!res.ok) throw new Error()
      setContract(prev => prev ? { ...prev, trang_thai: status } : prev)
      setSuccessMsg('Đã cập nhật')
      setTimeout(() => setSuccessMsg(''), 2000)
    } catch {} finally { setUpdating(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><span className="crm-spinner" /></div>
  if (!contract) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <p className="text-gray-500 text-sm">Không tìm thấy hợp đồng</p>
      <button onClick={() => router.push('/dashboard/contracts')} className="text-blue-600 text-sm font-semibold">← Quay lại</button>
    </div>
  )

  const isLogistics = myRole === 'logistics'
  const DELIVERY_STATUSES = ['Chờ xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Đã giao', 'Đã thanh toán']
  const DELIVERY_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    'Chờ xác nhận':  { bg: 'bg-gray-100',   text: 'text-gray-600' },
    'Đang chuẩn bị': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    'Đang giao':     { bg: 'bg-blue-100',   text: 'text-blue-700' },
    'Đã giao':       { bg: 'bg-green-100',  text: 'text-green-700' },
    'Đã thanh toán': { bg: 'bg-green-200',  text: 'text-green-800' },
  }
  const statusMap = isLogistics ? DELIVERY_STATUS_COLORS : CONTRACT_STATUS_COLORS
  const statusList = isLogistics ? DELIVERY_STATUSES : CONTRACT_STATUSES
  const sc = statusMap[contract.trang_thai] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/dashboard/contracts')} className="text-gray-500 p-2.5 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-800">{contract.khach_hang}</h1>
          <p className="text-xs text-gray-400">{contract.ma_hd}</p>
        </div>
        {successMsg && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">{successMsg}</span>}
      </div>

      <div className="p-4 space-y-4">
        {/* Status */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">{isLogistics ? 'TRẠNG THÁI GIAO HÀNG' : 'TRẠNG THÁI HỢP ĐỒNG'}</p>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold px-3 py-1.5 rounded-xl ${sc.bg} ${sc.text}`}>
              {contract.trang_thai || '—'}
            </span>
            <button onClick={() => setShowStatus(true)} disabled={updating}
              className="text-xs text-blue-600 font-semibold bg-blue-50 px-4 py-2 rounded-xl">
              {updating ? 'Đang lưu...' : 'Cập nhật'}
            </button>
          </div>
        </div>

        {/* Financial */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">GIÁ TRỊ HỢP ĐỒNG</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Giá trị HĐ</span>
              <span className="text-xl font-bold text-green-600">{fmtMoney(contract.gia_tri_hd)}</span>
            </div>
            {contract.hh_kinh_doanh > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">HH kinh doanh</span>
                <span className="text-sm font-semibold text-blue-600">{fmtMoney(contract.hh_kinh_doanh)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <a href={`tel:${contract.sdt}`}
            className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center gap-2">
            <span className="text-xl">📞</span>
            <div>
              <p className="text-xs font-semibold text-gray-700">Gọi điện</p>
              <p className="text-xs text-gray-400">{contract.sdt}</p>
            </div>
          </a>
          <a href={`https://zalo.me/${contract.sdt.replace(/^0/, '84')}`} target="_blank" rel="noopener noreferrer"
            className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center gap-2">
            <span className="text-xl">💬</span>
            <div>
              <p className="text-xs font-semibold text-gray-700">Zalo</p>
              <p className="text-xs text-gray-400">{contract.sdt}</p>
            </div>
          </a>
        </div>

        {/* Xem KH */}
        {contract.customer_id && (
          <button onClick={() => router.push(`/dashboard/customers/${contract.customer_id}`)}
            className="w-full bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex items-center gap-3 text-left">
            <span className="text-xl">👤</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700">Xem khách hàng</p>
              <p className="text-xs text-gray-400 truncate">{contract.khach_hang}</p>
            </div>
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Details */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">CHI TIẾT HỢP ĐỒNG</p>
          <InfoRow label="Khách hàng" value={contract.khach_hang} />
          <InfoRow label="Số điện thoại" value={contract.sdt} />
          <InfoRow label="Người phụ trách" value={contract.nguoi_phu_trach} />
          <InfoRow label="Sản phẩm chính" value={contract.san_pham.join(', ')} />
          <InfoRow label="Địa chỉ công trình" value={contract.dia_chi_ct} />
          <InfoRow label="Ngày ký" value={fmtDate(contract.ngay_ky)} />
          <InfoRow label="Ngày giao DK" value={fmtDate(contract.ngay_giao_dk)} />
          {contract.ngay_giao_thuc ? <InfoRow label="Ngày giao thực" value={fmtDate(contract.ngay_giao_thuc)} /> : null}
          {contract.ghi_chu && <InfoRow label="Ghi chú" value={contract.ghi_chu} />}
          {contract.source_quote_id && (
            <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-400 w-36 flex-shrink-0 pt-0.5">Báo giá gốc</span>
              <button
                onClick={() => router.push(`/dashboard/quotes/${contract.source_quote_id}`)}
                className="text-sm text-blue-600 font-semibold hover:underline">
                Xem báo giá #{contract.source_quote_id}
              </button>
            </div>
          )}
        </div>

        {/* Xác nhận giao hàng */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400">XÁC NHẬN GIAO HÀNG</p>
            {deliveryConfirmed
              ? <span className="text-xs text-green-600 font-medium">✓ Đã giao {new Date(deliveryConfirmed).toLocaleDateString('vi-VN')}</span>
              : <button onClick={() => setShowDeliveryForm(v => !v)}
                  className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-lg">
                  {showDeliveryForm ? 'Đóng' : 'Xác nhận giao'}
                </button>
            }
          </div>

          {showDeliveryForm && !deliveryConfirmed && (
            <div className="space-y-2 mb-3">
              <textarea
                value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)}
                placeholder="Ghi chú giao hàng (tùy chọn)..." rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 outline-none focus:border-blue-400 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => deliveryFileRef.current?.click()} disabled={uploadingDelivery}
                  className="flex-1 border border-gray-200 text-gray-600 text-xs font-semibold py-2.5 rounded-xl hover:bg-gray-50">
                  📷 Chụp/Tải ảnh
                </button>
                <button onClick={() => confirmDelivery()} disabled={uploadingDelivery}
                  className="flex-1 bg-green-600 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50">
                  {uploadingDelivery ? 'Đang lưu...' : '✓ Xác nhận'}
                </button>
              </div>
              <input ref={deliveryFileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) confirmDelivery(f); e.target.value = '' }} />
            </div>
          )}

          {deliveryPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {deliveryPhotos.map((url, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                  <img src={url} alt={`Ảnh giao ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
          {deliveryPhotos.length === 0 && deliveryConfirmed && (
            <p className="text-xs text-gray-400">Không có ảnh giao hàng</p>
          )}
          {!deliveryConfirmed && !showDeliveryForm && (
            <p className="text-sm text-gray-400 text-center py-2">Chưa xác nhận giao hàng</p>
          )}
        </div>

        {/* Bảo hành */}
        {warrantyReady === false && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
            <p className="text-xs text-amber-700 font-medium">Module bảo hành chưa được kích hoạt</p>
          </div>
        )}
        {warrantyReady && warranties.length > 0 && (() => {
          const w = warranties[0]
          const daysLeft = w.days_left as number
          const isActive = w.is_active as boolean
          return (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400">BẢO HÀNH SẢN PHẨM</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {isActive ? `Còn ${daysLeft} ngày` : 'Đã hết hạn'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-xs text-gray-400">Bắt đầu</p>
                  <p className="font-semibold text-gray-700">{new Date(w.bat_dau).toLocaleDateString('vi-VN')}</p>
                </div>
                <div className="text-gray-300">→</div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Hết hạn</p>
                  <p className={`font-semibold ${isActive ? 'text-gray-700' : 'text-red-600'}`}>
                    {new Date(w.het_han).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Loại BH</p>
                  <p className="font-semibold text-gray-700 text-xs">{w.loai_bh}</p>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Yêu cầu bảo hành */}
        {warrantyReady && <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400">YÊU CẦU BẢO HÀNH</p>
            <button onClick={() => setShowAddTicket(v => !v)}
              className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-lg">
              {showAddTicket ? 'Đóng' : '+ Tạo yêu cầu'}
            </button>
          </div>

          {showAddTicket && (
            <div className="space-y-2 mb-3 pb-3 border-b border-gray-100">
              <input value={ticketTitle} onChange={e => setTicketTitle(e.target.value)}
                placeholder="Tiêu đề yêu cầu *"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
              <textarea rows={2} value={ticketMoTa} onChange={e => setTicketMoTa(e.target.value)}
                placeholder="Mô tả vấn đề..."
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 resize-none" />
              <select value={ticketPriority} onChange={e => setTicketPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:border-blue-400">
                {['Khẩn cấp', 'Cao', 'Bình thường', 'Thấp'].map(p => <option key={p}>{p}</option>)}
              </select>
              <button
                onClick={async () => {
                  if (!ticketTitle.trim()) return
                  setSavingTicket(true)
                  const res = await fetch('/api/warranty-tickets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      order_id:    Number(id),
                      customer_id: contract?.customer_id,
                      warranty_id: warranties[0]?.id ?? null,
                      title:       ticketTitle.trim(),
                      mo_ta:       ticketMoTa.trim() || null,
                      priority:    ticketPriority,
                    }),
                  })
                  const json = await res.json()
                  if (json.data) {
                    setWTickets(prev => [json.data, ...prev])
                    setTicketTitle(''); setTicketMoTa(''); setShowAddTicket(false)
                  }
                  setSavingTicket(false)
                }}
                disabled={!ticketTitle.trim() || savingTicket}
                className="w-full py-2.5 bg-blue-600 disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl">
                {savingTicket ? 'Đang tạo...' : 'Tạo yêu cầu'}
              </button>
            </div>
          )}

          {wTickets.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">Chưa có yêu cầu bảo hành</p>
          ) : (
            <div className="space-y-2">
              {wTickets.map(t => {
                const statusColor: Record<string, string> = {
                  'Chờ xử lý':  'bg-amber-100 text-amber-700',
                  'Đang xử lý': 'bg-blue-100 text-blue-700',
                  'Hoàn thành': 'bg-green-100 text-green-700',
                  'Đóng':       'bg-gray-100 text-gray-600',
                }
                const prioColor: Record<string, string> = {
                  'Khẩn cấp': 'text-red-600', 'Cao': 'text-orange-500',
                  'Bình thường': 'text-gray-500', 'Thấp': 'text-gray-400',
                }
                return (
                  <div key={t.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800 flex-1">{t.title}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusColor[t.trang_thai] ?? 'bg-gray-100 text-gray-600'}`}>
                        {t.trang_thai}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-medium ${prioColor[t.priority] ?? ''}`}>{t.priority}</span>
                      {t.nguoi_xu_ly_name && <span className="text-[10px] text-gray-400">→ {t.nguoi_xu_ly_name}</span>}
                      <span className="text-[10px] text-gray-400 ml-auto">{new Date(t.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>}

        {/* Xuất PDF */}
        <button
          onClick={async () => {
            setExportingPDF(true)
            try { await downloadContractPDF(contract) }
            catch { /* silent */ }
            finally { setExportingPDF(false) }
          }}
          disabled={exportingPDF}
          className="w-full bg-blue-600 disabled:bg-blue-400 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-sm active:bg-blue-700">
          <span>📄</span>
          {exportingPDF ? 'Đang tạo PDF...' : 'Xuất PDF Hợp đồng'}
        </button>
      </div>

      {/* Status picker */}
      {showStatus && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={e => e.target === e.currentTarget && setShowStatus(false)}>
          <div className="bg-white rounded-t-3xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Cập nhật trạng thái</h2>
            </div>
            <div className="p-4 space-y-2 pb-8">
              {statusList.map(s => {
                const c = statusMap[s] ?? { bg: 'bg-gray-50', text: 'text-gray-600' }
                return (
                  <button key={s} onClick={() => { updateStatus(s); setShowStatus(false) }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left ${
                      contract.trang_thai === s ? `${c.bg} ${c.text}` : 'hover:bg-gray-50 text-gray-700'
                    }`}>
                    <span className="text-sm font-medium">{s}</span>
                    {contract.trang_thai === s && <span className="text-xs">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
