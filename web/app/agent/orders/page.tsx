'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import { authApi } from '@/lib/api/auth'
import { agentApi, Order, AgentStats, Product } from '@/lib/api/agent'
import AgentHeader from '@/components/AgentHeader'
import Modal from '@/components/Modal'
import Image from 'next/image'

const ORDER_STATUSES = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'preparing', label: 'Đang giao' },
  { value: 'delivered', label: 'Đã giao' },
]

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready: 'bg-orange-100 text-orange-800', // Giữ cho tương thích với dữ liệu cũ
  delivered_by_agent: 'bg-purple-100 text-purple-800',
  delivered: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang giao',
  ready: 'Đang giao', // "ready" hiển thị là "Đang giao"
  delivered_by_agent: 'Chờ khách xác nhận',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
}

const NEXT_STATUS: Record<string, string> = {
  pending: 'confirmed', // Cho phép chuyển từ pending → confirmed
  confirmed: 'preparing',
  preparing: 'delivered_by_agent',
  ready: 'delivered_by_agent', // Cho tương thích với dữ liệu cũ
}

export default function AgentOrdersPage() {
  const router = useRouter()
  const { user, isAuthenticated, viewMode, setViewMode } = useAuthStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<AgentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [availableProducts, setAvailableProducts] = useState<any[]>([])
  const [isHydrated, setIsHydrated] = useState(false)
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
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return

    if (!isAuthenticated || !user || user.role !== 'agent') {
      router.push('/login')
      return
    }
    
    // Tự động chuyển sang agent mode khi vào trang agent
    if (viewMode !== 'agent') {
      setViewMode('agent')
    }
  }, [isHydrated, isAuthenticated, user, router, viewMode, setViewMode])

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user || user.role !== 'agent') return

    authApi.getCurrentUser().catch(console.error)
    fetchData()
  }, [isHydrated, isAuthenticated, user?.id, selectedStatus])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [ordersRes, pendingRes, statsRes] = await Promise.all([
        agentApi.getOrders(selectedStatus || undefined),
        agentApi.getPendingOrders(),
        agentApi.getDashboard(),
      ])

      if (ordersRes.success && ordersRes.data) {
        setOrders(ordersRes.data)
      }
      if (pendingRes.success && pendingRes.data) {
        setPendingOrders(pendingRes.data)
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptOrder = async (orderId: number) => {
    // Mở modal chỉnh sửa thay vì nhận đơn ngay
    try {
      const response = await agentApi.getPendingOrder(orderId)
      if (response.success) {
        setEditingOrder(response.data)
        // Load available products for selection
        const productsRes = await agentApi.getProducts()
        if (productsRes.success) {
          setAvailableProducts(productsRes.data)
        }
      }
    } catch (error: any) {
      setModal({
        isOpen: true,
        type: 'alert',
        title: 'Lỗi',
        message: 'Không thể tải chi tiết đơn hàng: ' + (error.response?.data?.message || error.message),
      })
    }
  }

  const handleSaveOrderEdit = async () => {
    if (!editingOrder) return

    try {
      // Separate existing items (with real IDs) and new items (with temporary negative IDs)
      const existingItems = editingOrder.items.filter((item) => item.id && item.id > 0)
      const newItems = editingOrder.items.filter((item) => !item.id || item.id < 0)

      const items = [
        // Existing items with item_id
        ...existingItems.map((item) => ({
          item_id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        // New items without item_id
        ...newItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      ]

      const discount = parseFloat(editingOrder.discount || '0')

      const response = await agentApi.updateOrderBeforeAccept(editingOrder.id, {
        items,
        discount,
      })

      if (response.success) {
        setEditingOrder(response.data)
        setModal({
          isOpen: true,
          type: 'alert',
          title: 'Thành công',
          message: 'Đã cập nhật đơn hàng!',
        })
        // Reload pending orders to reflect changes
        const pendingRes = await agentApi.getPendingOrders()
        if (pendingRes.success) {
          setPendingOrders(pendingRes.data)
        }
      }
    } catch (error: any) {
      setModal({
        isOpen: true,
        type: 'alert',
        title: 'Lỗi',
        message: 'Không thể cập nhật đơn hàng: ' + (error.response?.data?.message || error.message),
      })
    }
  }

  const handleConfirmAcceptOrder = async () => {
    if (!editingOrder) return

    setModal({
      isOpen: true,
      type: 'confirm',
      title: 'Xác nhận',
      message: 'Bạn có chắc chắn muốn xác nhận nhận đơn hàng này?',
      onConfirm: async () => {
        try {
          const response = await agentApi.acceptOrder(editingOrder!.id)
          if (response.success) {
            setModal({
              isOpen: true,
              type: 'alert',
              title: 'Thành công',
              message: 'Đã nhận đơn hàng thành công!',
            })
            setEditingOrder(null)
            fetchData()
          }
        } catch (error: any) {
          setModal({
            isOpen: true,
            type: 'alert',
            title: 'Lỗi',
            message: 'Không thể nhận đơn hàng: ' + (error.response?.data?.message || error.message),
          })
        }
      },
    })
  }

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    setModal({
      isOpen: true,
      type: 'confirm',
      title: 'Xác nhận',
      message: `Bạn có chắc chắn muốn cập nhật trạng thái đơn hàng thành "${STATUS_LABELS[newStatus]}"?`,
      onConfirm: async () => {
        try {
          const response = await agentApi.updateOrderStatus(orderId, newStatus)
          if (response.success) {
            setModal({
              isOpen: true,
              type: 'alert',
              title: 'Thành công',
              message: 'Đã cập nhật trạng thái đơn hàng!',
            })
            fetchData()
            if (selectedOrder && selectedOrder.id === orderId) {
              setSelectedOrder(response.data)
            }
          }
        } catch (error: any) {
          setModal({
            isOpen: true,
            type: 'alert',
            title: 'Lỗi',
            message: 'Không thể cập nhật trạng thái: ' + (error.response?.data?.message || error.message),
          })
        }
      },
    })
  }

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

  const getStatusLabel = (status: string, order?: Order) => {
    if (status === 'delivered_by_agent' && order?.user?.name) {
      return `Chờ ${order.user.name} xác nhận`
    }
    if (status === 'confirmed' && order) {
      // Ưu tiên agent name, nếu không có thì dùng acceptedBy name
      const agentName = order.agent?.name || order.acceptedBy?.name
      if (agentName) {
        return `${agentName} đã xác nhận`
      }
    }
    return STATUS_LABELS[status] || status
  }

  const formatQuantityWithUnit = (item: any) => {
    const product = item.product
    const quantity = item.quantity
    
    if (product.quantity_per_unit && product.unit) {
      const qtyPerUnit = parseFloat(product.quantity_per_unit)
      const totalQty = qtyPerUnit * quantity
      // Loại bỏ .00 nếu có
      const formattedQtyPerUnit = qtyPerUnit % 1 === 0 ? qtyPerUnit.toString() : qtyPerUnit.toFixed(2).replace(/\.?0+$/, '')
      const formattedTotal = totalQty % 1 === 0 ? totalQty.toString() : totalQty.toFixed(2).replace(/\.?0+$/, '')
      return `${product.name}: ${formattedQtyPerUnit} ${product.unit} × ${quantity} = ${formattedTotal} ${product.unit}`
    }
    return `${product.name} x ${quantity}`
  }

  const calculateItemTotal = (item: any) => {
    const price = parseFloat(item.price)
    const quantity = item.quantity
    
    // Giá là giá cho 1 quantity_per_unit (nếu có) hoặc 1 đơn vị (nếu không có)
    // Ví dụ: 35.000 đ/100 Cái, quantity = 2 → 35.000 × 2 = 70.000 đ
    return price * quantity
  }

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

  if (!isAuthenticated || !user || user.role !== 'agent') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AgentHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Quản lý đơn hàng</h1>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div
              onClick={() => setSelectedStatus('')}
              className={`bg-white rounded-lg shadow-md p-4 cursor-pointer transition hover:shadow-lg ${
                selectedStatus === '' ? 'ring-2 ring-primary-600' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-500 mb-1">Tất cả</div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.total_orders + pendingOrders.length}
              </div>
            </div>
            <div
              onClick={() => setSelectedStatus('new')}
              className={`bg-white rounded-lg shadow-md p-4 cursor-pointer transition hover:shadow-lg ${
                selectedStatus === 'new' ? 'ring-2 ring-purple-600' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-500 mb-1">Đơn mới</div>
              <div className="text-2xl font-bold text-purple-600">{pendingOrders.length}</div>
            </div>
            <div
              onClick={() => setSelectedStatus('confirmed')}
              className={`bg-white rounded-lg shadow-md p-4 cursor-pointer transition hover:shadow-lg ${
                selectedStatus === 'confirmed' ? 'ring-2 ring-blue-600' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-500 mb-1">Đã xác nhận</div>
              <div className="text-2xl font-bold text-blue-600">{stats.confirmed_orders}</div>
            </div>
            <div
              onClick={() => setSelectedStatus('preparing')}
              className={`bg-white rounded-lg shadow-md p-4 cursor-pointer transition hover:shadow-lg ${
                selectedStatus === 'preparing' ? 'ring-2 ring-orange-600' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-500 mb-1">Đang giao</div>
              <div className="text-2xl font-bold text-orange-600">{stats.preparing_orders}</div>
            </div>
            <div
              onClick={() => setSelectedStatus('delivered')}
              className={`bg-white rounded-lg shadow-md p-4 cursor-pointer transition hover:shadow-lg ${
                selectedStatus === 'delivered' ? 'ring-2 ring-gray-600' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-500 mb-1">Đã giao</div>
              <div className="text-2xl font-bold text-gray-600">{stats.delivered_orders}</div>
            </div>
          </div>
        )}

        {/* Pending Orders (chưa có agent) */}
        {pendingOrders.length > 0 && (selectedStatus === '' || selectedStatus === 'new') && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-yellow-900 mb-4">
              Đơn hàng chờ nhận ({pendingOrders.length})
            </h2>
            <div className="space-y-4">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-lg shadow p-4 flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium text-gray-900">Đơn hàng #{order.id}</p>
                    <p className="text-sm text-gray-600">Khách hàng: {order.user.name}</p>
                    <p className="text-sm text-gray-600">Tổng tiền: {formatPrice(order.total_amount)}</p>
                    <p className="text-xs text-gray-500">Ngày đặt: {formatDate(order.created_at)}</p>
                  </div>
                  <button
                    onClick={() => handleAcceptOrder(order.id)}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition font-medium"
                  >
                    Nhận đơn hàng
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orders List */}
        {selectedStatus === 'new' ? (
          // Hiển thị pending orders khi chọn "Đơn mới"
          pendingOrders.length === 0 ? (
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
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Không có đơn hàng mới</h2>
              <p className="text-gray-600">Hiện tại không có đơn hàng nào chờ nhận</p>
            </div>
          ) : null
        ) : loading ? (
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
            <p className="text-gray-600">
              {selectedStatus
                ? `Không có đơn hàng với trạng thái "${ORDER_STATUSES.find((s) => s.value === selectedStatus)?.label}"`
                : 'Bạn chưa có đơn hàng nào'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mã đơn
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Khách hàng
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                      Sản phẩm
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tổng tiền
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        <div>
                          <span>#{order.id}</span>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {formatDate(order.created_at)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <p className="font-medium text-gray-900">{order.user.name}</p>
                          <p className="text-xs text-gray-500">{order.user.phone || order.phone}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        <div className="max-w-full">
                          <p className="font-medium text-gray-900">
                            {order.items.length} sản phẩm
                          </p>
                          <div className="text-xs text-gray-500 space-y-1 mt-1">
                            {order.items.map((item) => (
                              <p key={item.id} className="line-clamp-1">
                                {formatQuantityWithUnit(item)}
                              </p>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatPrice(order.total_amount)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-col gap-2">
                          <span
                            className={`px-3 py-1.5 inline-flex text-sm leading-5 font-bold rounded-lg w-fit ${
                              STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {getStatusLabel(order.status, order)}
                          </span>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="text-primary-600 hover:text-primary-900 text-xs"
                            >
                              Chi tiết
                            </button>
                            {NEXT_STATUS[order.status] && (
                              <button
                                onClick={() => handleUpdateStatus(order.id, NEXT_STATUS[order.status]!)}
                                className="text-green-600 hover:text-green-900 text-xs"
                              >
                                {order.status === 'pending' && 'Xác nhận đơn'}
                                {order.status === 'confirmed' && 'Bắt đầu giao'}
                                {(order.status === 'preparing' || order.status === 'ready') && 'Xác nhận đã giao'}
                              </button>
                            )}
                            {order.status !== 'delivered' && order.status !== 'cancelled' && (
                              <button
                                onClick={() => {
                                  setModal({
                                    isOpen: true,
                                    type: 'confirm',
                                    title: 'Xác nhận hủy đơn',
                                    message: 'Bạn có chắc chắn muốn hủy đơn hàng này?',
                                    onConfirm: () => {
                                      handleUpdateStatus(order.id, 'cancelled')
                                    },
                                  })
                                }}
                                className="text-red-600 hover:text-red-900 text-xs"
                              >
                                Hủy đơn
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Order Modal (Before Accept) */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setEditingOrder(null)}
            ></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-gray-900">
                    Chỉnh sửa đơn hàng #{editingOrder.id} - Trước khi nhận
                  </h3>
                  <button
                    onClick={() => setEditingOrder(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Customer Info */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Thông tin khách hàng</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="font-medium">Tên:</span> {editingOrder.user.name}</p>
                    <p><span className="font-medium">Email:</span> {editingOrder.user.email}</p>
                    <p><span className="font-medium">SĐT:</span> {editingOrder.user.phone || editingOrder.phone}</p>
                    <p><span className="font-medium">Địa chỉ:</span> {editingOrder.delivery_address}</p>
                    {editingOrder.notes && (
                      <p className="col-span-2"><span className="font-medium">Ghi chú:</span> {editingOrder.notes}</p>
                    )}
                  </div>
                </div>

                {/* Order Items - Editable */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-gray-900">Danh sách sản phẩm</h4>
                    <button
                      onClick={() => {
                        if (!editingOrder || availableProducts.length === 0) return
                        const firstProduct = availableProducts[0]
                        const newItems = [
                          ...editingOrder.items,
                          {
                            id: -Date.now(), // Temporary negative ID to distinguish from real IDs
                            product_id: firstProduct.id,
                            quantity: 1,
                            price: firstProduct.wholesale_price || firstProduct.price || '0',
                            product: {
                              id: firstProduct.id,
                              name: firstProduct.name,
                              image: firstProduct.image || null,
                            },
                          },
                        ]
                        setEditingOrder({ ...editingOrder, items: newItems })
                      }}
                      className="bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={availableProducts.length === 0}
                    >
                      + Thêm sản phẩm
                    </button>
                  </div>
                  <div className="space-y-3">
                    {editingOrder.items.map((item, index) => (
                      <div key={item.id || index} className="flex gap-4 p-4 bg-gray-50 rounded-lg items-center">
                        <div className="flex-1">
                          <select
                            value={item.product_id}
                            onChange={(e) => {
                              const productId = parseInt(e.target.value)
                              const product = availableProducts.find((p) => p.id === productId)
                              if (product && editingOrder) {
                                const newItems = [...editingOrder.items]
                                newItems[index] = {
                                  ...newItems[index],
                                  product_id: productId,
                                  product: {
                                    id: product.id,
                                    name: product.name,
                                    image: product.image || null,
                                  },
                                  price: product.wholesale_price || product.price || '0',
                                }
                                setEditingOrder({ ...editingOrder, items: newItems })
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            {availableProducts.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name} - {formatPrice(product.wholesale_price || product.price)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">Số lượng:</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const quantity = parseInt(e.target.value) || 1
                              if (editingOrder) {
                                const newItems = [...editingOrder.items]
                                newItems[index] = { ...newItems[index], quantity }
                                setEditingOrder({ ...editingOrder, items: newItems })
                              }
                            }}
                            className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div className="text-sm font-medium text-gray-900 min-w-[120px] text-right">
                          {formatPrice(calculateItemTotal(item))}
                        </div>
                        <button
                          onClick={() => {
                            if (editingOrder) {
                              const newItems = editingOrder.items.filter((_, i) => i !== index)
                              setEditingOrder({ ...editingOrder, items: newItems })
                            }
                          }}
                          className="text-red-600 hover:text-red-700 font-medium px-2"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Discount */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chiết khấu (đ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={parseFloat(editingOrder.discount || '0')}
                    onChange={(e) => {
                      const discount = parseFloat(e.target.value) || 0
                      setEditingOrder({ ...editingOrder, discount: discount.toString() })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Order Summary */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Tổng tiền:</span>
                    <span className="text-primary-600">
                      {formatPrice(
                        Math.max(
                          0,
                          editingOrder.items.reduce(
                            (sum, item) => sum + calculateItemTotal(item),
                            0
                          ) - parseFloat(editingOrder.discount || '0')
                        )
                      )}
                    </span>
                  </div>
                </div>

                {/* Audit Logs */}
                {editingOrder.audit_logs && editingOrder.audit_logs.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Lịch sử thay đổi</h4>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                      <div className="space-y-2 text-sm">
                        {editingOrder.audit_logs.map((log) => (
                          <div key={log.id} className="flex justify-between items-start pb-2 border-b border-gray-200 last:border-0">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{log.description}</p>
                              <p className="text-xs text-gray-500">
                                {log.user.name} - {formatDate(log.created_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setEditingOrder(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSaveOrderEdit}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    Lưu thay đổi
                  </button>
                  <button
                    onClick={handleConfirmAcceptOrder}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
                  >
                    Xác nhận nhận đơn
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setSelectedOrder(null)}
            ></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-gray-900">
                    Chi tiết đơn hàng #{selectedOrder.id}
                  </h3>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Customer Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Thông tin khách hàng</h4>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-medium">Tên:</span> {selectedOrder.user.name}
                      </p>
                      <p>
                        <span className="font-medium">Email:</span> {selectedOrder.user.email}
                      </p>
                      <p>
                        <span className="font-medium">SĐT:</span> {selectedOrder.user.phone || selectedOrder.phone}
                      </p>
                      <p>
                        <span className="font-medium">Địa chỉ:</span> {selectedOrder.delivery_address}
                      </p>
                      {selectedOrder.notes && (
                        <p>
                          <span className="font-medium">Ghi chú:</span> {selectedOrder.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Order Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Thông tin đơn hàng</h4>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-medium">Trạng thái:</span>{' '}
                        <span
                          className={`px-3 py-1.5 inline-flex text-sm leading-5 font-bold rounded-lg ${
                            STATUS_COLORS[selectedOrder.status] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {getStatusLabel(selectedOrder.status, selectedOrder)}
                        </span>
                      </p>
                      <p>
                        <span className="font-medium">Tổng tiền:</span>{' '}
                        <span className="text-lg font-bold text-primary-600">
                          {formatPrice(selectedOrder.total_amount)}
                        </span>
                      </p>
                      {selectedOrder.profit !== undefined && (
                        <p>
                          <span className="font-medium">Lợi nhuận:</span>{' '}
                          <span className="text-lg font-bold text-purple-600">
                            {formatPrice(selectedOrder.profit)}
                          </span>
                        </p>
                      )}
                      <p>
                        <span className="font-medium">Ngày đặt:</span> {formatDate(selectedOrder.created_at)}
                      </p>
                      <p>
                        <span className="font-medium">Cập nhật:</span> {formatDate(selectedOrder.updated_at)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Sản phẩm</h4>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex gap-4 p-4 bg-gray-50 rounded-lg"
                      >
                        {item.product.image ? (
                          <Image
                            src={item.product.image}
                            alt={item.product.name}
                            width={80}
                            height={80}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">🍞</span>
                          </div>
                        )}
                        <div className="flex-grow">
                          <h5 className="font-medium text-gray-900">{item.product.name}</h5>
                          <p className="text-sm text-gray-600">
                            {formatQuantityWithUnit(item)}
                          </p>
                          <p className="text-sm text-gray-600">
                            Giá: {formatPrice(item.price)} × {item.quantity} ={' '}
                            {formatPrice(calculateItemTotal(item))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
                  >
                    Đóng
                  </button>
                  {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                    <button
                      onClick={() => {
                        setModal({
                          isOpen: true,
                          type: 'confirm',
                          title: 'Xác nhận hủy đơn',
                          message: 'Bạn có chắc chắn muốn hủy đơn hàng này?',
                          onConfirm: () => {
                            handleUpdateStatus(selectedOrder.id, 'cancelled')
                            setSelectedOrder(null)
                          },
                        })
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                    >
                      Hủy đơn
                    </button>
                  )}
                  {NEXT_STATUS[selectedOrder.status] && (
                    <button
                      onClick={() => {
                        handleUpdateStatus(selectedOrder.id, NEXT_STATUS[selectedOrder.status]!)
                        setSelectedOrder(null)
                      }}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
                    >
                      {selectedOrder.status === 'confirmed' && 'Bắt đầu giao'}
                      {(selectedOrder.status === 'preparing' || selectedOrder.status === 'ready') && 'Đã giao'}
                    </button>
                  )}
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

