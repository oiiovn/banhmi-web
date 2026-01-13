'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import { authApi } from '@/lib/api/auth'

export default function AgentHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, viewMode, setViewMode } = useAuthStore()
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const handleLogout = async () => {
    await authApi.logout()
    router.push('/')
  }

  const handleSwitchToCustomer = () => {
    setViewMode('customer')
    router.push('/')
  }

  if (!isHydrated || !isAuthenticated || !user || user.role !== 'agent') {
    return null
  }

  // Nếu đang ở chế độ customer view, không hiển thị agent header
  if (viewMode === 'customer') {
    return null
  }

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/agent">
            <h1 className="text-2xl font-bold text-primary-600">🍞 Banhmi - Đại lý</h1>
          </Link>
          <div className="flex gap-4 items-center">
            <Link
              href="/agent"
              className={`text-sm font-medium transition ${
                pathname === '/agent'
                  ? 'text-primary-600 font-bold'
                  : 'text-gray-700 hover:text-primary-600'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/agent/orders"
              className={`text-sm font-medium transition ${
                pathname === '/agent/orders'
                  ? 'text-primary-600 font-bold'
                  : 'text-gray-700 hover:text-primary-600'
              }`}
            >
              Đơn hàng
            </Link>
            <Link
              href="/agent/products"
              className={`text-sm font-medium transition ${
                pathname === '/agent/products'
                  ? 'text-primary-600 font-bold'
                  : 'text-gray-700 hover:text-primary-600'
              }`}
            >
              Sản phẩm
            </Link>
            <Link
              href="/agent/debts"
              className={`text-sm font-medium transition ${
                pathname === '/agent/debts'
                  ? 'text-primary-600 font-bold'
                  : 'text-gray-700 hover:text-primary-600'
              }`}
            >
              Công nợ
            </Link>
            <span className="text-gray-500">|</span>
            <button
              onClick={handleSwitchToCustomer}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
            >
              Chuyển sang Khách hàng
            </button>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">🏪 Đại lý</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-700 hover:text-primary-600 text-sm"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

