'use client'
// HĐ-D1: Redirect cũ → URL mới /dashboard/contracts
// Giữ file này để không 404 nếu có bookmark/link cũ

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function OrdersRedirect() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const qs = searchParams.toString()
    router.replace(`/dashboard/contracts${qs ? '?' + qs : ''}`)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <span className="crm-spinner" />
    </div>
  )
}
