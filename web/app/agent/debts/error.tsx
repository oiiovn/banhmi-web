'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Error in agent/debts page:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Đã xảy ra lỗi!</h2>
        <p className="text-gray-600 mb-6">{error.message || 'Có lỗi xảy ra khi tải trang'}</p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
        >
          Thử lại
        </button>
      </div>
    </div>
  )
}




