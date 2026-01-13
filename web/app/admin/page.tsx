'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store/authStore'
import { adminApi } from '@/lib/api/admin'

export default function AdminDashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isHydrated, setIsHydrated] = useState(false)

  // Wait for auth store to hydrate
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    
    if (!isAuthenticated || !user || user.role !== 'admin') {
      router.push('/login')
      return
    }
    fetchDashboard()
  }, [isHydrated, isAuthenticated, user, router])

  const fetchDashboard = async () => {
    try {
      setLoading(true)
      const response = await adminApi.getDashboard()
      if (response.success) {
        setStats(response.data)
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  // Don't render until hydrated to avoid flash
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user || user.role !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/">
              <h1 className="text-2xl font-bold text-primary-600">🍞 Banhmi Admin</h1>
            </Link>
            <div className="flex gap-4 items-center">
              <Link href="/admin/agents" className="text-gray-700 hover:text-primary-600">
                Đại lý
              </Link>
              <Link href="/admin/customers" className="text-gray-700 hover:text-primary-600">
                Khách hàng
              </Link>
              <span className="text-gray-500">|</span>
              <span className="text-sm text-gray-700">{user.name}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">Dashboard</h2>

        {loading ? (
          <div className="text-center py-8">Đang tải...</div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Tổng Khách hàng</h3>
              <p className="text-3xl font-bold text-primary-600">{stats.total_customers}</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Tổng Đại lý</h3>
              <p className="text-3xl font-bold text-primary-600">{stats.total_agents}</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Tổng Sản phẩm</h3>
              <p className="text-3xl font-bold text-primary-600">{stats.total_products}</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Tổng Đơn hàng</h3>
              <p className="text-3xl font-bold text-primary-600">{stats.total_orders}</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Đơn hàng Chờ xử lý</h3>
              <p className="text-3xl font-bold text-yellow-600">{stats.pending_orders}</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Tổng Doanh thu</h3>
              <p className="text-3xl font-bold text-green-600">
                {parseFloat(stats.total_revenue || 0).toLocaleString('vi-VN')} đ
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">Không thể tải dữ liệu</p>
          </div>
        )}

        <div className="mt-8 flex gap-4">
          <Link
            href="/admin/agents"
            className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700"
          >
            Quản lý Đại lý →
          </Link>
          <Link
            href="/admin/customers"
            className="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
          >
            Quản lý Khách hàng →
          </Link>
        </div>
      </div>
    </div>
  )
}

