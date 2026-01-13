'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import { authApi } from '@/lib/api/auth'
import { agentApi, AgentStats, Order, Product } from '@/lib/api/agent'
import AgentHeader from '@/components/AgentHeader'
import Modal from '@/components/Modal'

export default function AgentDashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout, viewMode, setViewMode } = useAuthStore()
  const [stats, setStats] = useState<AgentStats | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [isHydrated, setIsHydrated] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
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

  // Wait for auth store to hydrate
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
    
    // Refresh user data to ensure role is up to date (only once on mount)
    authApi.getCurrentUser().catch(console.error)
    
    // Initial fetch
    fetchData()
  }, [isHydrated, isAuthenticated, user?.id])

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user || user.role !== 'agent') return
    
    // Fetch orders when status filter changes
    const fetchOrders = async () => {
      try {
        setLoading(true)
        const ordersRes = await agentApi.getOrders(selectedStatus || undefined)
        if (ordersRes.success && ordersRes.data) {
          // Chỉ hiển thị các đơn hàng chưa delivered (cần xử lý)
          const filteredOrders = ordersRes.data.filter(
            (order: Order) => order.status !== 'delivered' && order.status !== 'cancelled'
          )
          setOrders(filteredOrders)
        }
      } catch (error) {
        console.error('Error fetching orders:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchOrders()
  }, [selectedStatus, isHydrated, isAuthenticated, user?.id])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [dashboardRes, ordersRes, pendingRes] = await Promise.all([
        agentApi.getDashboard(),
        agentApi.getOrders(selectedStatus || undefined),
        agentApi.getPendingOrders(),
      ])

      // Update states only if data is available
      if (dashboardRes.success && dashboardRes.data) {
        setStats(dashboardRes.data)
      }
      if (ordersRes.success && ordersRes.data) {
        // Chỉ hiển thị các đơn hàng chưa delivered (cần xử lý)
        const filteredOrders = ordersRes.data.filter(
          (order: Order) => order.status !== 'delivered' && order.status !== 'cancelled'
        )
        setOrders(filteredOrders)
      }
      if (pendingRes.success && pendingRes.data) {
        setPendingOrders(pendingRes.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
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
    try {
      const response = await agentApi.updateOrderStatus(orderId, newStatus)
      if (response.success) {
        fetchData()
      }
    } catch (error: any) {
      setModal({
        isOpen: true,
        type: 'alert',
        title: 'Lỗi',
        message: 'Không thể cập nhật trạng thái: ' + (error.response?.data?.message || error.message),
      })
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      preparing: 'bg-purple-100 text-purple-800',
      ready: 'bg-green-100 text-green-800',
      delivered: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      pending: 'Chờ xử lý',
      confirmed: 'Đã xác nhận',
      preparing: 'Đang chuẩn bị',
      ready: 'Sẵn sàng',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy',
    }
    return texts[status] || status
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
    return getStatusText(status)
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

  if (!isAuthenticated || !user || user.role !== 'agent') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AgentHeader />

      <div className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">Dashboard Đại lý</h2>

        {/* Statistics */}
        {loading && !stats ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
            <p className="text-gray-600">Đang tải...</p>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Tổng đơn hàng</h3>
              <p className="text-3xl font-bold text-primary-600">{stats.total_orders}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Chờ xử lý</h3>
              <p className="text-3xl font-bold text-yellow-600">{stats.pending_orders}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Đang xử lý</h3>
              <p className="text-3xl font-bold text-blue-600">
                {stats.confirmed_orders + stats.preparing_orders + stats.ready_orders}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Doanh thu</h3>
              <p className="text-3xl font-bold text-green-600">
                {parseFloat(stats.total_revenue.toString()).toLocaleString('vi-VN')} đ
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Lợi nhuận</h3>
              <p className="text-3xl font-bold text-purple-600">
                {parseFloat((stats.total_profit || 0).toString()).toLocaleString('vi-VN')} đ
              </p>
            </div>
          </div>
        ) : null}

        {/* Pending Orders Section */}
        {pendingOrders.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <h3 className="text-xl font-bold mb-4 text-yellow-800">
              Đơn hàng chưa được nhận ({pendingOrders.length})
            </h3>
            <div className="space-y-4">
              {pendingOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="bg-white rounded-lg p-4 shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">Đơn hàng #{order.id}</p>
                      <p className="text-sm text-gray-600">
                        {order.user.name} - {order.user.phone || order.user.email}
                      </p>
                      <p className="text-sm text-gray-600">{order.delivery_address}</p>
                      <p className="text-primary-600 font-bold mt-1">
                        {parseFloat(order.total_amount).toLocaleString('vi-VN')} đ
                      </p>
                    </div>
                    <button
                      onClick={() => handleAcceptOrder(order.id)}
                      className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                    >
                      Nhận đơn
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-xl font-bold">Đơn hàng cần xử lý</h3>
          </div>
          {loading ? (
            <div className="text-center py-8">Đang tải...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Chưa có đơn hàng nào</p>
            </div>
          ) : (
            <div className="divide-y">
              {orders.map((order) => (
                <div key={order.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-bold">Đơn hàng #{order.id}</h4>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {getStatusLabel(order.status, order)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Khách hàng: <span className="font-medium">{order.user.name}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        SĐT: {order.user.phone || order.user.email}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Địa chỉ: {order.delivery_address}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        <span className="font-medium">Ngày đặt hàng:</span>{' '}
                        {new Date(order.created_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary-600 mb-2">
                        {parseFloat(order.total_amount).toLocaleString('vi-VN')} đ
                      </p>
                      {order.status === 'confirmed' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'preparing')}
                          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm"
                        >
                          Bắt đầu giao
                        </button>
                      )}
                      {(order.status === 'preparing' || order.status === 'ready') && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'delivered_by_agent')}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
                        >
                          Xác nhận đã giao
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <h5 className="font-semibold mb-2">Sản phẩm:</h5>
                    <div className="space-y-1">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span>
                            {formatQuantityWithUnit(item)}
                          </span>
                          <span className="font-medium">
                            {formatPrice(calculateItemTotal(item))}
                          </span>
                        </div>
                      ))}
                    </div>
                    {order.notes && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm">
                          <span className="font-semibold">Ghi chú:</span> {order.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Order Modal */}
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
                            id: -Date.now(),
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
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSaveOrderEdit}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    Lưu thay đổi
                  </button>
                  <button
                    onClick={handleConfirmAcceptOrder}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
                  >
                    Xác nhận nhận đơn
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

