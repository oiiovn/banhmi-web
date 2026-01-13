'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store/authStore'
import api from '@/lib/api'
import Modal from '@/components/Modal'

interface Customer {
  id: number
  name: string
  email: string
  phone?: string
  address?: string
  role: 'customer'
  is_active: boolean
  customer_orders_count?: number
}

export default function AdminCustomersPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{
    isOpen: boolean
    type: 'alert' | 'confirm'
    title?: string
    message: string
    onConfirm?: () => void
    confirmText?: string
    cancelText?: string
  }>({
    isOpen: false,
    type: 'alert',
    message: '',
  })

  useEffect(() => {
    if (!isAuthenticated || !user || user.role !== 'admin') {
      router.push('/login')
      return
    }
    fetchCustomers()
  }, [isAuthenticated, user, router])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/customers')
      if (response.data.success) {
        setCustomers(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgradeToAgent = async (id: number) => {
    setModal({
      isOpen: true,
      type: 'confirm',
      title: 'Xác nhận nâng cấp',
      message: 'Bạn có chắc chắn muốn nâng cấp khách hàng này lên Đại lý?\n\nLưu ý: Người dùng này cần đăng xuất và đăng nhập lại để thấy thay đổi.',
      onConfirm: async () => {
        try {
          const response = await api.post(`/admin/customers/${id}/upgrade-to-agent`)
          if (response.data.success) {
            setModal({
              isOpen: true,
              type: 'alert',
              title: 'Thành công',
              message: 'Đã nâng cấp thành công!\n\nNgười dùng cần đăng xuất và đăng nhập lại để thấy thay đổi.',
              onConfirm: () => {
                fetchCustomers()
                router.push('/admin/agents')
              },
            })
          }
        } catch (error: any) {
          setModal({
            isOpen: true,
            type: 'alert',
            title: 'Lỗi',
            message: 'Không thể nâng cấp: ' + (error.response?.data?.message || error.message),
          })
        }
      },
    })
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
              <Link href="/admin" className="text-gray-700 hover:text-primary-600">
                Dashboard
              </Link>
              <Link href="/admin/agents" className="text-gray-700 hover:text-primary-600">
                Đại lý
              </Link>
              <span className="text-gray-500">|</span>
              <span className="text-sm text-gray-700">{user.name}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">Quản lý Khách hàng</h2>

        {loading ? (
          <div className="text-center py-8">Đang tải...</div>
        ) : customers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">Chưa có khách hàng nào</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tên
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Số điện thoại
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Đơn hàng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {customer.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.customer_orders_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleUpgradeToAgent(customer.id)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        Nâng cấp lên Đại lý
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
      />
    </div>
  )
}

