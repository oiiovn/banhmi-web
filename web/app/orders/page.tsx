'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuthStore } from '@/lib/store/authStore'
import { useOrderNotificationStore, STATUSES_TO_TRACK } from '@/lib/store/orderNotificationStore'
import api from '@/lib/api'
import CustomerHeader from '@/components/CustomerHeader'
import Modal from '@/components/Modal'

interface OrderItem {
  id: number
  product_id: number
  quantity: number
  price: string
  product: {
    id: number
    name: string
    image: string | null
  }
}

interface OrderAuditLog {
  id: number
  order_id: number
  user_id: number
  action: string
  entity_type: string | null
  entity_id: number | null
  old_value: any
  new_value: any
  description: string | null
  created_at: string
  updated_at: string
  user: {
    id: number
    name: string
    email: string
  }
}

interface Order {
  id: number
  user_id: number
  agent_id: number | null
  total_amount: string
  discount?: string
  status: string
  delivery_address: string
  phone: string
  notes: string | null
  created_at: string
  updated_at: string
  items: OrderItem[]
  user: {
    id: number
    name: string
    email: string
  }
  agent: {
    id: number
    name: string
  } | null
  audit_logs?: OrderAuditLog[]
}

const ORDER_STATUSES = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'preparing', label: 'Đang giao' }, // Gộp cả preparing và ready
  { value: 'delivered_by_agent', label: 'Chờ xác nhận' },
  { value: 'delivered', label: 'Đã giao' },
  { value: 'cancelled', label: 'Đã hủy' },
]


const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready: 'bg-orange-100 text-orange-800',
  delivered_by_agent: 'bg-purple-100 text-purple-800',
  delivered: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang giao',
  ready: 'Đang giao',
  delivered_by_agent: 'Chờ xác nhận đã nhận',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
}

export default function OrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, user } = useAuthStore()
  const { markOrderAsViewed, markAllOrdersAsViewed, isOrderViewed, viewedOrders } = useOrderNotificationStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [allOrders, setAllOrders] = useState<Order[]>([]) // Lưu tất cả đơn hàng để tính stats
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [markAllChecked, setMarkAllChecked] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    delivery: false,
    auditLogs: false,
  })

  // Set default expanded sections based on screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      // iPad trở lên (768px+): mở Thông tin giao hàng
      // Lịch sử thay đổi luôn đóng mặc định
      setExpandedSections({
        delivery: width >= 768, // iPad trở lên
        auditLogs: false, // Luôn đóng mặc định
      })
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])
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

  // Fetch chi tiết đơn hàng theo ID
  const fetchOrderDetails = useCallback(async (orderId: number) => {
    try {
      const response = await api.get(`/orders/${orderId}`)
      if (response.data.success) {
        setSelectedOrder(response.data.data)
        // Set default expanded sections based on screen size
        const width = window.innerWidth
        setExpandedSections({
          delivery: width >= 768, // iPad trở lên
          auditLogs: false, // Luôn đóng mặc định
        })
        // Giữ lại returnTo và debtId trong URL nếu có, chỉ xóa orderId
        const status = searchParams.get('status')
        const returnTo = searchParams.get('returnTo')
        const debtId = searchParams.get('debtId')
        let newUrl = '/orders'
        const params: string[] = []
        if (status) params.push(`status=${status}`)
        if (returnTo) params.push(`returnTo=${returnTo}`)
        if (debtId) params.push(`debtId=${debtId}`)
        if (params.length > 0) {
          newUrl = `/orders?${params.join('&')}`
        }
        router.replace(newUrl, { scroll: false })
      }
    } catch (error) {
      console.error('Error fetching order details:', error)
    }
  }, [searchParams, router])

  // Wait for auth store to hydrate
  useEffect(() => {
    setIsHydrated(true)
    // Reset checkbox khi load lại trang
    setMarkAllChecked(false)
  }, [])

  // Đọc status và orderId từ URL query parameter khi component mount
  useEffect(() => {
    if (isHydrated && searchParams && isInitialLoad) {
      const statusFromUrl = searchParams.get('status')
      if (statusFromUrl) {
        setSelectedStatus(statusFromUrl)
      }
      
      // Kiểm tra orderId từ URL để tự động mở modal
      const orderIdFromUrl = searchParams.get('orderId')
      if (orderIdFromUrl) {
        const orderId = parseInt(orderIdFromUrl, 10)
        if (!isNaN(orderId)) {
          fetchOrderDetails(orderId)
        }
      }
      
      setIsInitialLoad(false)
    }
  }, [isHydrated, searchParams, isInitialLoad, fetchOrderDetails])

  useEffect(() => {
    if (!isHydrated) return
    
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    // Fetch tất cả đơn hàng để tính stats (chỉ fetch 1 lần khi mount)
    if (allOrders.length === 0) {
      fetchAllOrdersForStats()
    }

    // Fetch đơn hàng theo filter
    fetchOrders()
  }, [isHydrated, isAuthenticated, router, selectedStatus])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      // Nếu selectedStatus là 'preparing', cần fetch cả 'preparing' và 'ready'
      let params: any = {}
      if (selectedStatus === 'preparing') {
        // Fetch tất cả orders và filter ở frontend để lấy cả preparing và ready
        params = {}
      } else if (selectedStatus) {
        params = { status: selectedStatus }
      }
      const response = await api.get('/orders', { params })
      if (response.data.success) {
        let filteredOrders = response.data.data
        // Nếu selectedStatus là 'preparing', filter để lấy cả preparing và ready
        if (selectedStatus === 'preparing') {
          filteredOrders = filteredOrders.filter(
            (order: Order) => order.status === 'preparing' || order.status === 'ready'
          )
        }
        setOrders(filteredOrders)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch tất cả đơn hàng để tính stats (không filter)
  const fetchAllOrdersForStats = async () => {
    try {
      const response = await api.get('/orders', { params: {} })
      if (response.data.success) {
        setAllOrders(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching all orders for stats:', error)
    }
  }

  // Cập nhật URL khi selectedStatus thay đổi (trừ lần đầu load từ URL)
  useEffect(() => {
    if (isHydrated && !isInitialLoad) {
      const newUrl = selectedStatus 
        ? `/orders?status=${selectedStatus}`
        : '/orders'
      router.replace(newUrl, { scroll: false })
    }
  }, [selectedStatus, isHydrated, isInitialLoad, router])

  const formatPrice = (price: string | number) => {
    return parseFloat(price.toString()).toLocaleString('vi-VN') + ' đ'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatOrderId = (id: number) => {
    return `BM-${id.toString().padStart(3, '0')}`
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      add_item: 'Thêm sản phẩm',
      remove_item: 'Xóa sản phẩm',
      update_quantity: 'Cập nhật số lượng',
      update_discount: 'Cập nhật chiết khấu',
      accept_order: 'Đại lý nhận đơn hàng',
    }
    return labels[action] || action
  }

  const formatChangeValue = (value: any, order?: Order): string => {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number') return value.toString()
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'object') {
      // Format quantity changes (có thể có product_name)
      if (value.quantity !== undefined) {
        if (value.product_name) {
          return `${value.product_name}: ${value.quantity}`
        }
        return `Số lượng: ${value.quantity}`
      }
      // Format product changes (thêm/xóa sản phẩm)
      if (value.product_name && !value.quantity) {
        return `${value.product_name} x ${value.quantity || ''}`
      }
      // Format discount changes
      if (value.discount !== undefined) {
        return formatPrice(value.discount)
      }
      // Format status and agent_id changes (for accept_order action)
      if (value.status !== undefined) {
        const statusLabel = STATUS_LABELS[value.status] || value.status
        const parts = [statusLabel]
        if (value.agent_id !== undefined && value.agent_id !== null) {
          // Tìm tên đại lý từ order hoặc từ agent_id
          let agentName = 'Đại lý'
          if (order?.agent) {
            agentName = order.agent.name
          } else if (order && order.agent_id === value.agent_id) {
            // Nếu order có agent_id trùng, có thể order đã có agent relationship
            agentName = order.agent?.name || 'Đại lý'
          }
          parts.push(agentName)
        } else if (value.agent_id === null) {
          parts.push('Chưa có đại lý')
        }
        return parts.join(', ')
      }
      // For other objects, try to format nicely
      const formatted: string[] = []
      if (value.product_id) formatted.push(`SP ID: ${value.product_id}`)
      if (value.price) formatted.push(`Giá: ${formatPrice(value.price)}`)
      if (formatted.length > 0) return formatted.join(', ')
      // Last resort: don't show raw JSON
      return ''
    }
    return String(value)
  }

  // Calculate statistics từ tất cả đơn hàng (không phụ thuộc vào filter)
  const stats = {
    total: allOrders.length,
    pending: allOrders.filter((o) => o.status === 'pending').length,
    confirmed: allOrders.filter((o) => o.status === 'confirmed').length,
    preparing: allOrders.filter((o) => o.status === 'preparing' || o.status === 'ready').length,
    delivered_by_agent: allOrders.filter((o) => o.status === 'delivered_by_agent').length,
    delivered: allOrders.filter((o) => o.status === 'delivered').length,
    cancelled: allOrders.filter((o) => o.status === 'cancelled').length,
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

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Header */}
      <div className="hidden md:block">
      <CustomerHeader />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden bg-white shadow-sm sticky top-0 z-50 border-b border-gray-200">
        <div className="px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-bold text-gray-900">Đơn hàng</h1>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={markAllChecked}
              onChange={(e) => {
                const checked = e.target.checked
                setMarkAllChecked(checked)
                if (checked) {
                  // Đánh dấu tất cả đơn hàng có status cần track là đã xem
                  const orderIdsToMark = allOrders
                    .filter((order) => STATUSES_TO_TRACK.includes(order.status))
                    .map((order) => order.id)
                  markAllOrdersAsViewed(orderIdsToMark)
                }
              }}
              className="w-4 h-4 text-blue-400 border-gray-300 rounded focus:ring-blue-400 focus:ring-2"
              style={{
                accentColor: '#60a5fa', // blue-400
              }}
            />
            <span className="text-xs text-gray-500">Xem tất cả</span>
          </label>
        </div>
        {/* Mobile Tabs - Scrollable */}
        <div className="px-2 pb-2 overflow-x-auto scrollbar-hide -mx-2 bg-white">
          <div className="flex gap-2 min-w-max px-2">
            {ORDER_STATUSES.map((status) => {
              // Tính count dựa trên status value
              let count = 0
              if (status.value === '') {
                count = stats.total
              } else if (status.value === 'pending') {
                count = stats.pending
              } else if (status.value === 'confirmed') {
                count = stats.confirmed
              } else if (status.value === 'preparing') {
                count = stats.preparing
              } else if (status.value === 'delivered_by_agent') {
                count = stats.delivered_by_agent
              } else if (status.value === 'delivered') {
                count = stats.delivered
              } else if (status.value === 'cancelled') {
                count = stats.cancelled
              }
              
              const isActive = selectedStatus === status.value
              return (
                <button
                  key={status.value}
                  onClick={() => setSelectedStatus(status.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                  }`}
                >
                  {status.label}
                  {count > 0 && <span className="ml-1">({count})</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-2 py-2 md:py-4">
        {/* Desktop Title */}
        <h1 className="hidden md:block text-xl font-bold text-gray-900 mb-3">Đơn hàng của tôi</h1>

        {/* Desktop Statistics Cards */}
        <div className="hidden md:grid md:grid-cols-4 lg:grid-cols-7 gap-2 mb-3">
          <div
            onClick={() => setSelectedStatus('')}
            className={`bg-white rounded-lg shadow-sm p-3 cursor-pointer transition hover:shadow-md ${
              selectedStatus === '' ? 'ring-2 ring-primary-600' : ''
            }`}
          >
            <div className="text-xs font-medium text-gray-500 mb-0.5">Tất cả</div>
            <div className="text-xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div
            onClick={() => setSelectedStatus('pending')}
            className={`bg-white rounded-lg shadow-sm p-3 cursor-pointer transition hover:shadow-md ${
              selectedStatus === 'pending' ? 'ring-2 ring-yellow-600' : ''
            }`}
          >
            <div className="text-xs font-medium text-gray-500 mb-0.5">Chờ xử lý</div>
            <div className="text-xl font-bold text-yellow-600">{stats.pending}</div>
          </div>
          <div
            onClick={() => setSelectedStatus('confirmed')}
            className={`bg-white rounded-lg shadow-sm p-3 cursor-pointer transition hover:shadow-md ${
              selectedStatus === 'confirmed' ? 'ring-2 ring-blue-600' : ''
            }`}
          >
            <div className="text-xs font-medium text-gray-500 mb-0.5">Đã xác nhận</div>
            <div className="text-xl font-bold text-blue-600">{stats.confirmed}</div>
          </div>
          <div
            onClick={() => setSelectedStatus('preparing')}
            className={`bg-white rounded-lg shadow-sm p-3 cursor-pointer transition hover:shadow-md ${
              selectedStatus === 'preparing' ? 'ring-2 ring-orange-600' : ''
            }`}
          >
            <div className="text-xs font-medium text-gray-500 mb-0.5">Đang giao</div>
            <div className="text-xl font-bold text-orange-600">{stats.preparing}</div>
          </div>
          <div
            onClick={() => setSelectedStatus('delivered_by_agent')}
            className={`bg-white rounded-lg shadow-sm p-3 cursor-pointer transition hover:shadow-md ${
              selectedStatus === 'delivered_by_agent' ? 'ring-2 ring-purple-600' : ''
            }`}
          >
            <div className="text-xs font-medium text-gray-500 mb-0.5">Chờ xác nhận</div>
            <div className="text-xl font-bold text-purple-600">{stats.delivered_by_agent}</div>
          </div>
          <div
            onClick={() => setSelectedStatus('delivered')}
            className={`bg-white rounded-lg shadow-sm p-3 cursor-pointer transition hover:shadow-md ${
              selectedStatus === 'delivered' ? 'ring-2 ring-gray-600' : ''
            }`}
          >
            <div className="text-xs font-medium text-gray-500 mb-0.5">Đã giao</div>
            <div className="text-xl font-bold text-gray-600">{stats.delivered}</div>
          </div>
          <div
            onClick={() => setSelectedStatus('cancelled')}
            className={`bg-white rounded-lg shadow-sm p-3 cursor-pointer transition hover:shadow-md ${
              selectedStatus === 'cancelled' ? 'ring-2 ring-red-600' : ''
            }`}
          >
            <div className="text-xs font-medium text-gray-500 mb-0.5">Đã hủy</div>
            <div className="text-xl font-bold text-red-600">{stats.cancelled}</div>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
            <p className="text-gray-600">Đang tải đơn hàng...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg
              className="w-24 h-24 mx-auto text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Chưa có đơn hàng</h2>
            <p className="text-gray-600 mb-6">
              {selectedStatus
                ? `Không có đơn hàng với trạng thái "${ORDER_STATUSES.find((s) => s.value === selectedStatus)?.label}"`
                : 'Bạn chưa có đơn hàng nào'}
            </p>
            {!selectedStatus && (
              <Link
                href="/"
                className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition font-medium"
              >
                Đặt hàng ngay
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2 pb-4 md:pb-0">
            {orders.map((order) => {
              // Kiểm tra xem đơn hàng có trạng thái thay đổi chưa được xem
              const isUnread = !isOrderViewed(order.id, order.updated_at) && 
                STATUSES_TO_TRACK.includes(order.status)
              
              return (
              <div
                key={order.id}
                onClick={() => {
                  setSelectedOrder(order)
                  // Đánh dấu đơn hàng đã xem chi tiết
                  markOrderAsViewed(order.id)
                }}
                className={`rounded-lg shadow-sm hover:shadow-md transition-shadow p-3 cursor-pointer active:bg-gray-50 ${
                  isUnread ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white'
                }`}
              >
                <div className="flex justify-between items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <h3 className="text-sm font-bold text-gray-900">{formatOrderId(order.id)}</h3>
                        <span
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                            STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mb-1">{formatDate(order.created_at)}</p>
                    <p className="text-xs text-gray-600 line-clamp-1">
                      {order.items.map((item) => item.product.name).join(', ')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-gray-900">
                        {formatPrice(order.total_amount)}
                      </p>
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                    {order.status === 'delivered_by_agent' && (
                        <button
                        onClick={async (e) => {
                          e.stopPropagation() // Ngăn mở modal khi click nút
                          setModal({
                            isOpen: true,
                            type: 'confirm',
                            title: 'Xác nhận đã nhận hàng',
                            message: 'Bạn có chắc chắn đã nhận được hàng?',
                            onConfirm: async () => {
                              try {
                                const response = await api.post(`/orders/${order.id}/confirm-received`)
                                if (response.data.success) {
                                  setModal({
                                    isOpen: true,
                                    type: 'alert',
                                    title: 'Thành công',
                                    message: 'Đã xác nhận nhận hàng thành công!',
                                  })
                                  fetchOrders()
                                  fetchAllOrdersForStats()
                                  // Đánh dấu đơn hàng đã xem
                                  markOrderAsViewed(order.id)
                                }
                              } catch (error: any) {
                                setModal({
                                  isOpen: true,
                                  type: 'alert',
                                  title: 'Lỗi',
                                  message: 'Không thể xác nhận: ' + (error.response?.data?.message || error.message),
                                })
                              }
                            },
                          })
                        }}
                        className="px-2.5 py-0.5 bg-green-600 text-white text-[10px] font-medium rounded hover:bg-green-700 transition active:bg-green-800 whitespace-nowrap"
                      >
                        Đã nhận hàng
                        </button>
                    )}
                  </div>
                </div>
            </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => {
                const returnTo = searchParams.get('returnTo')
                const debtId = searchParams.get('debtId')
                setSelectedOrder(null)
                // Nếu có returnTo và debtId, chuyển về trang công nợ
                if (returnTo === 'debt' && debtId) {
                  router.push(`/debts?debtId=${debtId}`)
                }
              }}
            ></div>

            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle w-full max-w-2xl">
              <div className="bg-white px-5 py-4 sm:p-6">
                {/* Header - Tinh gọn kiểu SaaS */}
                <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Đơn hàng #{formatOrderId(selectedOrder.id)}
                  </h3>
                  <button
                    onClick={() => {
                      const returnTo = searchParams.get('returnTo')
                      const debtId = searchParams.get('debtId')
                      setSelectedOrder(null)
                      // Nếu có returnTo và debtId, chuyển về trang công nợ
                      if (returnTo === 'debt' && debtId) {
                        router.push(`/debts?debtId=${debtId}`)
                      }
                    }}
                    className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Thông tin đơn & giao hàng - Info cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  {/* Order Info */}
                  <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Thông tin đơn hàng</h4>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">Trạng thái:</span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-md ${
                            STATUS_COLORS[selectedOrder.status] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">Tổng tiền:</span>
                        <span className="text-xl font-bold text-primary-600">
                          {formatPrice(selectedOrder.total_amount)}
                        </span>
                      </div>
                      {selectedOrder.discount && parseFloat(selectedOrder.discount) > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs">Chiết khấu:</span>
                          <span className="text-sm text-red-600 font-medium">
                            -{formatPrice(selectedOrder.discount)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">Ngày đặt:</span>
                        <span className="text-xs text-gray-700">{formatDate(selectedOrder.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">Cập nhật:</span>
                        <span className="text-xs text-gray-700">{formatDate(selectedOrder.updated_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Info */}
                  <div className="border border-gray-200 rounded-xl p-4">
                    <button
                      onClick={() => setExpandedSections({ ...expandedSections, delivery: !expandedSections.delivery })}
                      className="flex items-center justify-between w-full mb-2"
                    >
                      <h4 className="text-sm font-semibold text-gray-900">Thông tin giao hàng</h4>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          expandedSections.delivery ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {expandedSections.delivery && (
                      <div className="space-y-1.5 text-sm pt-2 border-t border-gray-200">
                        <div className="flex items-start gap-2">
                          <span className="text-gray-500 text-xs flex-shrink-0">Tên:</span>
                          <span className="text-xs text-gray-700">{selectedOrder.user.name}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-gray-500 text-xs flex-shrink-0">Địa chỉ:</span>
                          <span className="text-xs text-gray-700">{selectedOrder.delivery_address}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs">SĐT:</span>
                          <span className="text-xs text-gray-700">{selectedOrder.phone}</span>
                        </div>
                      {selectedOrder.agent && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-xs">Đại lý:</span>
                            <span className="text-xs text-gray-700 font-medium">{selectedOrder.agent.name}</span>
                          </div>
                      )}
                      {selectedOrder.notes && (
                          <div className="flex items-start gap-2">
                            <span className="text-gray-500 text-xs flex-shrink-0">Ghi chú:</span>
                            <span className="text-xs text-gray-700">{selectedOrder.notes}</span>
                          </div>
                      )}
                    </div>
                    )}
                  </div>
                </div>

                {/* Danh sách sản phẩm - Tối giản như app food */}
                <div className="mb-5">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Sản phẩm</h4>
                  <div className="space-y-0 border border-gray-200 rounded-xl overflow-hidden">
                    {selectedOrder.items.map((item, index) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 py-3 px-4 ${
                          index !== selectedOrder.items.length - 1 ? 'border-b border-gray-200' : ''
                        }`}
                      >
                        {item.product.image ? (
                          <Image
                            src={item.product.image}
                            alt={item.product.name}
                            width={56}
                            height={56}
                            className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-xl">🍞</span>
                          </div>
                        )}
                        <div className="flex-grow min-w-0">
                          <h5 className="text-sm font-medium text-gray-900 mb-0.5">{item.product.name}</h5>
                          <p className="text-xs text-gray-500">
                            {item.quantity} × {formatPrice(item.price)}
                            <span className="ml-2 font-semibold text-gray-900">
                            {formatPrice(parseFloat(item.price) * item.quantity)}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audit Logs - Timeline hiện đại */}
                {selectedOrder.audit_logs && selectedOrder.audit_logs.length > 0 && (
                  <div className="mb-5">
                    <button
                      onClick={() =>
                        setExpandedSections({ ...expandedSections, auditLogs: !expandedSections.auditLogs })
                      }
                      className="flex items-center justify-between w-full mb-3"
                    >
                      <h4 className="text-sm font-semibold text-gray-900">
                        Lịch sử thay đổi ({selectedOrder.audit_logs.length})
                      </h4>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          expandedSections.auditLogs ? 'rotate-180' : ''
                        }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                                />
                              </svg>
                    </button>
                    {expandedSections.auditLogs && (
                      <div className="border border-gray-200 rounded-xl p-4 max-h-60 overflow-y-auto">
                        <div className="space-y-3">
                          {selectedOrder.audit_logs.map((log) => (
                            <div key={log.id} className="relative pl-5">
                              <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-primary-500"></div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-900 mb-0.5">
                                {log.description || getActionLabel(log.action)}
                              </p>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                  <span>{log.user.name}</span>
                                <span>•</span>
                                <span>{formatDate(log.created_at)}</span>
                              </div>
                              {/* Hiển thị chi tiết thay đổi nếu có */}
                              {log.old_value && log.new_value && (() => {
                                const oldFormatted = formatChangeValue(log.old_value, selectedOrder)
                                const newFormatted = formatChangeValue(log.new_value, selectedOrder)
                                if (oldFormatted || newFormatted) {
                                  return (
                                      <div className="mt-1.5 text-xs text-gray-600 bg-gray-50 rounded-md px-2 py-1.5 border border-gray-200">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                        {oldFormatted && (
                                          <span className="text-red-600 line-through">
                                            {oldFormatted}
                                          </span>
                                        )}
                                        {oldFormatted && newFormatted && (
                                          <span className="text-gray-400">→</span>
                                        )}
                                        {newFormatted && (
                                          <span className="text-green-600 font-medium">
                                            {newFormatted}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                }
                                return null
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    )}
                  </div>
                )}

                {/* Actions - Ít nhưng chất */}
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                  {selectedOrder.status === 'delivered_by_agent' && (
                    <button
                      onClick={() => {
                        setModal({
                          isOpen: true,
                          type: 'confirm',
                          title: 'Xác nhận',
                          message: 'Bạn có chắc chắn đã nhận được hàng?',
                          onConfirm: async () => {
                        try {
                          const response = await api.post(`/orders/${selectedOrder.id}/confirm-received`)
                          if (response.data.success) {
                                setModal({
                                  isOpen: true,
                                  type: 'alert',
                                  title: 'Thành công',
                                  message: 'Đã xác nhận nhận hàng thành công!',
                                })
                            setSelectedOrder(response.data.data)
                            fetchOrders()
                                fetchAllOrdersForStats()
                          }
                        } catch (error: any) {
                              setModal({
                                isOpen: true,
                                type: 'alert',
                                title: 'Lỗi',
                                message: 'Không thể xác nhận: ' + (error.response?.data?.message || error.message),
                              })
                            }
                          },
                        })
                      }}
                      className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition"
                    >
                      Xác nhận đã nhận hàng
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const returnTo = searchParams.get('returnTo')
                      const debtId = searchParams.get('debtId')
                      setSelectedOrder(null)
                      // Nếu có returnTo và debtId, chuyển về trang công nợ
                      if (returnTo === 'debt' && debtId) {
                        router.push(`/debts?debtId=${debtId}`)
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 font-medium transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
