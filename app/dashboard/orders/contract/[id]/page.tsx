'use client'
// HĐ-D2: Redirect cũ → URL mới /dashboard/contracts/b2c/[id]
// Giữ file này để không 404 nếu có bookmark/link cũ

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function ContractDetailRedirect() {
  const router = useRouter()
  const { id } = useParams() as { id: string }

  useEffect(() => {
    router.replace(`/dashboard/contracts/b2c/${id}`)
  }, [id, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <span className="crm-spinner" />
    </div>
  )
}
