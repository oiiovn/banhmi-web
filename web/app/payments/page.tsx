'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PaymentDetailClient from './PaymentDetailClient'

export default function PaymentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentId = searchParams.get('id')

  useEffect(() => {
    if (!paymentId) {
      router.replace('/debts')
    }
  }, [paymentId, router])

  if (!paymentId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-gray-600">Đang chuyển hướng...</p>
        </div>
      </div>
    )
  }

  return <PaymentDetailClient />
}
