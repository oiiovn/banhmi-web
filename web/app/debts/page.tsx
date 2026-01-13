'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import { authApi } from '@/lib/api/auth'
import { customerApi } from '@/lib/api/customer'
import { Debt, DebtStats, Payment, PaymentData } from '@/lib/api/agent'
import CustomerHeader from '@/components/CustomerHeader'
import Modal from '@/components/Modal'

const DEBT_STATUSES = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chưa thanh toán' },
  { value: 'partial', label: 'Thanh toán một phần' },
  { value: 'paid', label: 'Đã thanh toán' },
]

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-red-100 text-red-800',
  partial: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chưa thanh toán',
  partial: 'Thanh toán một phần',
  paid: 'Đã thanh toán',
  cancelled: 'Đã hủy',
}

// Format order ID as BM-XXX
const formatOrderId = (id: number) => {
  return `BM-${id.toString().padStart(3, '0')}`
}

export default function CustomerDebtsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, viewMode } = useAuthStore()
  const [debts, setDebts] = useState<Debt[]>([])
  const [stats, setStats] = useState<DebtStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  const [paymentData, setPaymentData] = useState<PaymentData>({
    debt_id: 0,
    amount: 0,
    payment_method: 'cash',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [isHydrated, setIsHydrated] = useState(false)
  const [highlightedPaymentId, setHighlightedPaymentId] = useState<number | null>(null)
  const paymentRowRef = useRef<HTMLTableRowElement | null>(null)
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

    // Cho phép customer hoặc agent ở chế độ customer xem trang công nợ
    if (!isAuthenticated || !user) {
      router.push('/login')
      return
    }
    
    // Nếu là agent nhưng đang ở chế độ agent, redirect về trang agent
    if (user.role === 'agent' && viewMode === 'agent') {
      router.push('/agent/debts')
      return
    }
    
    // Nếu là admin, redirect về trang admin
    if (user.role === 'admin') {
      router.push('/admin')
      return
    }
  }, [isHydrated, isAuthenticated, user, router, viewMode])

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user) return
    
    // Chỉ fetch data nếu là customer hoặc agent ở chế độ customer
    if (user.role === 'agent' && viewMode === 'agent') return
    if (user.role === 'admin') return

    authApi.getCurrentUser().catch(console.error)
    fetchData()
  }, [isHydrated, isAuthenticated, user?.id, selectedStatus, viewMode])

  // Đọc debtId và paymentId từ URL để tự động mở modal chi tiết công nợ và highlight payment
  useEffect(() => {
    if (!isHydrated || !searchParams || debts.length === 0) return
    
    const debtIdFromUrl = searchParams.get('debtId')
    const paymentIdFromUrl = searchParams.get('paymentId')
    
    if (debtIdFromUrl) {
      const debtId = parseInt(debtIdFromUrl, 10)
      if (!isNaN(debtId)) {
        // Tìm debt trong danh sách và mở modal
        const debt = debts.find(d => d.id === debtId)
        if (debt) {
          setSelectedDebt(debt)
          
          // Nếu có paymentId, highlight payment đó
          if (paymentIdFromUrl) {
            const paymentId = parseInt(paymentIdFromUrl, 10)
            if (!isNaN(paymentId)) {
              setHighlightedPaymentId(paymentId)
              // Scroll đến payment row sau khi modal mở
              setTimeout(() => {
                if (paymentRowRef.current) {
                  paymentRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              }, 300)
            }
          }
          
          // Xóa debtId và paymentId khỏi URL sau khi đã mở modal
          const newUrl = selectedStatus ? `/debts?status=${selectedStatus}` : '/debts'
          router.replace(newUrl, { scroll: false })
        }
      }
    }
  }, [isHydrated, searchParams, debts, selectedStatus, router])

  // Auto-remove highlight after 3 seconds
  useEffect(() => {
    if (highlightedPaymentId) {
      const timer = setTimeout(() => {
        setHighlightedPaymentId(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [highlightedPaymentId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await customerApi.getDebts(selectedStatus || undefined)

      if (response.success) {
        // Map debtOrders từ API response
        const debtsWithOrders = response.data.map((debt: any) => ({
          ...debt,
          debtOrders: debt.debt_orders || debt.debtOrders || [],
        }))
        setDebts(debtsWithOrders)
        setStats(response.stats)
      }
    } catch (error) {
      console.error('Error fetching debts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = (debt: Debt) => {
    // Reset state khi mở modal mới
    setIsSubmittingPayment(false)
    setSelectedDebt(debt)
    
    // Tính số tiền có thể thanh toán (trừ đi pending payments)
    const pendingPaymentsAmount = debt.payments
      ? debt.payments
          .filter((p: Payment) => p.status === 'pending_confirmation')
          .reduce((sum: number, p: Payment) => sum + parseFloat(p.amount), 0)
      : 0
    const availableAmount = parseFloat(debt.remaining_amount) - pendingPaymentsAmount
    
    setPaymentData({
      debt_id: debt.id,
      amount: availableAmount > 0 ? availableAmount : 0,
      payment_method: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      notes: '',
    })
    setShowPaymentModal(true)
  }

  const handleSubmitPayment = async () => {
    // Ngăn chặn submit nhiều lần
    if (isSubmittingPayment) {
      return
    }

    if (!paymentData.amount || paymentData.amount <= 0) {
      setModal({
        isOpen: true,
        type: 'alert',
        title: 'Lỗi',
        message: 'Vui lòng nhập số tiền thanh toán',
      })
      return
    }

    // Tính số tiền đang chờ xác nhận (pending_confirmation)
    const pendingPaymentsAmount = selectedDebt!.payments
      ? selectedDebt!.payments
          .filter((p: Payment) => p.status === 'pending_confirmation')
          .reduce((sum: number, p: Payment) => sum + parseFloat(p.amount), 0)
      : 0
    
    // Số tiền có thể thanh toán = remaining_amount - pending payments
    const availableAmount = parseFloat(selectedDebt!.remaining_amount) - pendingPaymentsAmount
    
    if (paymentData.amount > availableAmount) {
      let message = 'Số tiền thanh toán không được vượt quá số tiền còn lại.'
      if (pendingPaymentsAmount > 0) {
        message += ` Có ${formatCurrency(pendingPaymentsAmount)} đ đang chờ xác nhận.`
      }
      setModal({
        isOpen: true,
        type: 'alert',
        title: 'Lỗi',
        message: message,
      })
      return
    }

    // Tạo unique request ID để ngăn chặn duplicate payment
    const requestId = `payment_${selectedDebt!.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const requestKey = `payment_request_${selectedDebt!.id}`
    
    // Kiểm tra xem có request đang xử lý không (trong 5 giây gần đây)
    const lastRequest = sessionStorage.getItem(requestKey)
    if (lastRequest) {
      const lastRequestData = JSON.parse(lastRequest)
      const timeDiff = Date.now() - lastRequestData.timestamp
      if (timeDiff < 5000) { // 5 giây
        setModal({
          isOpen: true,
          type: 'alert',
          title: 'Thông báo',
          message: 'Đang xử lý thanh toán, vui lòng đợi...',
        })
        return
      }
    }

    // Lưu request ID vào sessionStorage
    sessionStorage.setItem(requestKey, JSON.stringify({
      requestId,
      timestamp: Date.now(),
      amount: paymentData.amount,
    }))

    setIsSubmittingPayment(true)
    try {
      const response = await customerApi.createPayment({
        ...paymentData,
        request_id: requestId, // Gửi request_id để backend check duplicate
      } as any)
      
      if (response.success) {
        // Xóa request ID sau khi thành công
        sessionStorage.removeItem(requestKey)
        
        setModal({
          isOpen: true,
          type: 'alert',
          title: 'Thành công',
          message: 'Thanh toán thành công!',
        })
        setShowPaymentModal(false)
        setSelectedDebt(null)
        fetchData()
      }
    } catch (error: any) {
      // Xóa request ID nếu có lỗi (trừ lỗi duplicate)
      if (error.response?.data?.message?.includes('duplicate') || 
          error.response?.data?.message?.includes('trùng')) {
        // Giữ lại request ID nếu là lỗi duplicate để ngăn submit lại
      } else {
        sessionStorage.removeItem(requestKey)
      }
      
      setModal({
        isOpen: true,
        type: 'alert',
        title: 'Lỗi',
        message: 'Lỗi: ' + (error.response?.data?.message || error.message),
      })
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  const formatCurrency = (amount: string | number): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('vi-VN').format(num)
  }

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('vi-VN')
  }

  const handleViewOrder = (orderId: number, debtId?: number) => {
    if (debtId) {
      router.push(`/orders?orderId=${orderId}&returnTo=debt&debtId=${debtId}`)
    } else {
      router.push(`/orders?orderId=${orderId}`)
    }
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

  // Tính stats từ debts để hiển thị trong tabs
  const calculatedStats = {
    total: debts.length,
    pending: debts.filter((d) => d.status === 'pending').length,
    partial: debts.filter((d) => d.status === 'partial').length,
    paid: debts.filter((d) => d.status === 'paid').length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Header */}
      <div className="hidden md:block">
        <CustomerHeader />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden bg-white shadow-sm sticky top-0 z-50 border-b border-gray-200">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">Công nợ</h1>
        </div>
        {/* Mobile Tabs - Scrollable */}
        <div className="px-2 pb-2 overflow-x-auto scrollbar-hide -mx-2 bg-white">
          <div className="flex gap-2 min-w-max px-2">
            {DEBT_STATUSES.map((status) => {
              // Tính count dựa trên status value
              let count = 0
              if (status.value === '') {
                count = calculatedStats.total
              } else if (status.value === 'pending') {
                count = calculatedStats.pending
              } else if (status.value === 'partial') {
                count = calculatedStats.partial
              } else if (status.value === 'paid') {
                count = calculatedStats.paid
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

      <div className="container mx-auto px-2 py-2 md:px-4 md:py-8">
        {/* Desktop Title */}
        <div className="hidden md:block mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Công nợ của tôi</h1>
          <p className="text-gray-600">Xem và thanh toán công nợ</p>
        </div>

        {/* Desktop Statistics Cards */}
        {stats && (
          <div className="hidden md:grid md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">Tổng công nợ</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total_debts}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">Tổng số tiền</div>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.total_amount)} đ</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">Đã thanh toán</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.total_paid)} đ</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">Còn lại</div>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.total_remaining)} đ</div>
            </div>
          </div>
        )}

        {/* Debts List */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
            <p className="text-gray-600">Đang tải công nợ...</p>
          </div>
        ) : debts.length === 0 ? (
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
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Chưa có công nợ</h2>
            <p className="text-gray-600">
              {selectedStatus
                ? `Không có công nợ với trạng thái "${DEBT_STATUSES.find((s) => s.value === selectedStatus)?.label}"`
                : 'Bạn chưa có công nợ nào'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: Card Layout */}
            <div className="md:hidden space-y-2 pb-4">
              {debts.map((debt) => (
                <div
                  key={debt.id}
                  onClick={async () => {
                    try {
                      const response = await customerApi.getDebt(debt.id)
                      if (response.success) {
                        const debtData = {
                          ...response.data,
                          debtOrders: response.data.debt_orders || response.data.debtOrders || [],
                        }
                        setSelectedDebt(debtData)
                      }
                    } catch (error) {
                      console.error('Error fetching debt details:', error)
                      setSelectedDebt(debt)
                    }
                  }}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-3 cursor-pointer active:bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-gray-900 mb-1">
                        {debt.agent?.name || 'Chưa có đại lý'}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {debt.debtOrders && debt.debtOrders.length > 0
                          ? `Số đơn hàng: ${debt.debtOrders.length} đơn`
                          : debt.order_id
                          ? 'Số đơn hàng: 1 đơn'
                          : '-'}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                        STATUS_COLORS[debt.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {STATUS_LABELS[debt.status] || debt.status}
                    </span>
                  </div>
                  <div className="space-y-1 mb-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Tổng tiền:</span>
                      <span className="font-medium text-gray-900">{formatCurrency(debt.total_amount)} đ</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Đã trả:</span>
                      <span className="font-medium text-green-600">{formatCurrency(debt.paid_amount)} đ</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Còn lại:</span>
                      <span className="font-bold text-red-600">{formatCurrency(debt.remaining_amount)} đ</span>
                    </div>
                  </div>
                  {debt.status !== 'paid' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePayment(debt)
                      }}
                      className="w-full mt-2 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition"
                    >
                      Thanh toán
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: Table Layout */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Công nợ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Số đơn hàng
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tổng tiền
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Đã trả
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Còn lại
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {debts.map((debt) => (
                    <tr key={debt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {debt.agent?.name || 'Chưa có đại lý'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {debt.debtOrders && debt.debtOrders.length > 0 ? (
                          <span className="font-medium text-primary-600">{debt.debtOrders.length} đơn</span>
                        ) : debt.order_id ? (
                          <span>1 đơn</span>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(debt.total_amount)} đ
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                        {formatCurrency(debt.paid_amount)} đ
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        {formatCurrency(debt.remaining_amount)} đ
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[debt.status] || 'bg-gray-100 text-gray-800'}`}
                        >
                          {STATUS_LABELS[debt.status] || debt.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={async () => {
                            try {
                              const response = await customerApi.getDebt(debt.id)
                              if (response.success) {
                                const debtData = {
                                  ...response.data,
                                  debtOrders: response.data.debt_orders || response.data.debtOrders || [],
                                }
                                setSelectedDebt(debtData)
                              }
                            } catch (error) {
                              console.error('Error fetching debt details:', error)
                              setSelectedDebt(debt)
                            }
                          }}
                          className="text-primary-600 hover:text-primary-800 font-medium"
                        >
                          Xem chi tiết
                        </button>
                        {debt.status !== 'paid' && (
                          <button
                            onClick={() => handlePayment(debt)}
                            className="text-green-600 hover:text-green-800 font-medium"
                          >
                            Thanh toán
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Debt Detail Modal */}
      {selectedDebt && !showPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setSelectedDebt(null)}
            ></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-3 pb-3 sm:p-4 sm:pb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold text-gray-900">Chi tiết công nợ #{selectedDebt.id}</h3>
                  <button
                    onClick={() => setSelectedDebt(null)}
                    className="text-gray-400 hover:text-gray-600"
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

                <div className="space-y-2">
                  {/* Debt Info */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Đại lý:</span>
                        <span>{selectedDebt.agent?.name || '-'}</span>
                      </div>
                      {selectedDebt.debtOrders && selectedDebt.debtOrders.length > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Số đơn hàng:</span>
                          <span>{selectedDebt.debtOrders.length} đơn</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Tổng tiền:</span>
                        <span className="font-bold">{formatCurrency(selectedDebt.total_amount)} đ</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Đã thanh toán:</span>
                        <span className="text-green-600 font-bold">
                          {formatCurrency(selectedDebt.paid_amount)} đ
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Còn lại:</span>
                        <span className="text-red-600 font-bold">
                          {formatCurrency(selectedDebt.remaining_amount)} đ
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Trạng thái:</span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${
                            STATUS_COLORS[selectedDebt.status] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {STATUS_LABELS[selectedDebt.status] || selectedDebt.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Orders List (for consolidated debt or single order debt) */}
                  {((selectedDebt.debtOrders && selectedDebt.debtOrders.length > 0) || selectedDebt.order_id) && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">
                        {selectedDebt.debtOrders && selectedDebt.debtOrders.length > 0
                          ? 'Lịch sử gộp công nợ'
                          : 'Thông tin đơn hàng'}
                      </h4>
                      {selectedDebt.debtOrders && selectedDebt.debtOrders.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
                          <p className="text-xs text-blue-800">
                            <span className="font-semibold">💡 Lưu ý:</span> Các đơn hàng này đã được tự động gộp vào công nợ tổng khi khách hàng xác nhận nhận hàng.
                          </p>
                        </div>
                      )}
                      <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="max-h-[200px] overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                                  Mã đơn
                                </th>
                              <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                                Ngày gộp
                              </th>
                              <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                                Số tiền
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {selectedDebt.debtOrders && selectedDebt.debtOrders.length > 0 ? (
                              // Consolidated debt - multiple orders - sắp xếp theo thời gian gộp vào công nợ (mới nhất lên đầu)
                              [...selectedDebt.debtOrders]
                                .sort((a, b) => {
                                  const dateA = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0
                                  const dateB = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0
                                  return dateB - dateA // Giảm dần (mới nhất lên đầu)
                                })
                                .map((debtOrder) => (
                                <tr 
                                  key={debtOrder.id} 
                                  className="hover:bg-gray-50 cursor-pointer"
                                  onClick={() => handleViewOrder(debtOrder.order_id, selectedDebt?.id)}
                                >
                                  <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                                    {formatOrderId(debtOrder.order_id)}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                                    {(debtOrder as any).created_at
                                      ? new Date((debtOrder as any).created_at).toLocaleDateString('vi-VN', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : '-'}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                                    {formatCurrency(debtOrder.amount)} đ
                                  </td>
                                </tr>
                              ))
                            ) : selectedDebt.order_id ? (
                              // Single order debt (old data)
                              <tr 
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={() => selectedDebt.order_id && handleViewOrder(selectedDebt.order_id, selectedDebt.id)}
                              >
                                <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                                  {formatOrderId(selectedDebt.order_id)}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                                  {selectedDebt.created_at
                                    ? new Date(selectedDebt.created_at).toLocaleDateString('vi-VN', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : '-'}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                                  {formatCurrency(selectedDebt.total_amount)} đ
                                </td>
                              </tr>
                            ) : null}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment History */}
                  {selectedDebt.payments && selectedDebt.payments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Lịch sử thanh toán</h4>
                      <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="max-h-[200px] overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                                  Ngày
                                </th>
                              <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                                Số tiền
                              </th>
                              <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                                Trạng thái
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {[...selectedDebt.payments]
                              .sort((a, b) => {
                                // Sắp xếp theo created_at (thời gian tạo) để thanh toán mới nhất lên đầu
                                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
                                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
                                return dateB - dateA // Giảm dần (mới nhất lên đầu)
                              })
                              .map((payment: any) => {
                                const getStatusInfo = (status?: string) => {
                                  if (!status || status === 'confirmed') {
                                    return {
                                      label: 'Đã xác nhận',
                                      color: 'bg-green-100 text-green-800',
                                      by: payment.confirmedBy ? ` bởi ${payment.confirmedBy.name}` : '',
                                    }
                                  }
                                  if (status === 'pending_confirmation') {
                                    return {
                                      label: 'Chờ xác nhận',
                                      color: 'bg-yellow-100 text-yellow-800',
                                      by: '',
                                    }
                                  }
                                  if (status === 'rejected') {
                                    return {
                                      label: 'Từ chối',
                                      color: 'bg-red-100 text-red-800',
                                      by: payment.confirmedBy ? ` bởi ${payment.confirmedBy.name}` : '',
                                    }
                                  }
                                  return {
                                    label: 'Đã xác nhận',
                                    color: 'bg-green-100 text-green-800',
                                    by: payment.confirmedBy ? ` bởi ${payment.confirmedBy.name}` : '',
                                  }
                                }
                                const statusInfo = getStatusInfo(payment.status)
                                const isHighlighted = highlightedPaymentId === payment.id
                                return (
                              <tr 
                                key={payment.id}
                                ref={isHighlighted ? paymentRowRef : null}
                                className={`hover:bg-gray-50 cursor-pointer transition-all ${
                                  isHighlighted 
                                    ? 'bg-yellow-100 border-l-4 border-yellow-500 shadow-md' 
                                    : ''
                                }`}
                                onClick={() => router.push(`/payments?id=${payment.id}`)}
                              >
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                  {payment.created_at
                                    ? new Date(payment.created_at).toLocaleDateString('vi-VN', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : formatDate(payment.payment_date)}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-green-600">
                                  {formatCurrency(payment.amount)} đ
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div className="flex flex-col gap-0.5">
                                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${statusInfo.color}`}>
                                      {statusInfo.label}
                                    </span>
                                    {statusInfo.by && (
                                      <span className="text-[10px] text-gray-500">
                                        {statusInfo.by}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )})}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedDebt.status !== 'paid' && (
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => handlePayment(selectedDebt)}
                        className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                      >
                        Thanh toán
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedDebt && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => {
                setShowPaymentModal(false)
                setSelectedDebt(null)
              }}
            ></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-gray-900">Thanh toán công nợ</h3>
                  <button
                    onClick={() => {
                      setShowPaymentModal(false)
                      setSelectedDebt(null)
                    }}
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

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Số tiền còn lại
                    </label>
                    <div className="text-lg font-bold text-red-600">
                      {formatCurrency(selectedDebt.remaining_amount)} đ
                    </div>
                    {selectedDebt.payments && selectedDebt.payments.some((p: Payment) => p.status === 'pending_confirmation') && (
                      <div className="mt-1">
                        {(() => {
                          const pendingAmount = selectedDebt.payments
                            .filter((p: Payment) => p.status === 'pending_confirmation')
                            .reduce((sum: number, p: Payment) => sum + parseFloat(p.amount), 0)
                          const availableAmount = parseFloat(selectedDebt.remaining_amount) - pendingAmount
                          return (
                            <div className="text-xs text-gray-600">
                              <span className="text-yellow-600 font-medium">
                                {formatCurrency(pendingAmount)} đ đang chờ xác nhận
                              </span>
                              <span className="ml-2">
                                (Có thể thanh toán: {formatCurrency(availableAmount)} đ)
                              </span>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Số tiền thanh toán <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      max={(() => {
                        if (!selectedDebt) return undefined
                        const pendingAmount = selectedDebt.payments
                          ? selectedDebt.payments
                              .filter((p: Payment) => p.status === 'pending_confirmation')
                              .reduce((sum: number, p: Payment) => sum + parseFloat(p.amount), 0)
                          : 0
                        return parseFloat(selectedDebt.remaining_amount) - pendingAmount
                      })()}
                      step="0.01"
                      value={paymentData.amount || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        setPaymentData({ ...paymentData, amount: value ? parseFloat(value) : 0 })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Nhập số tiền"
                    />
                    {selectedDebt && (() => {
                      const pendingAmount = selectedDebt.payments
                        ? selectedDebt.payments
                            .filter((p: Payment) => p.status === 'pending_confirmation')
                            .reduce((sum: number, p: Payment) => sum + parseFloat(p.amount), 0)
                        : 0
                      const availableAmount = parseFloat(selectedDebt.remaining_amount) - pendingAmount
                      if (pendingAmount > 0) {
                        return (
                          <p className="mt-1 text-xs text-gray-600">
                            Số tiền có thể thanh toán tối đa: <span className="font-semibold text-primary-600">{formatCurrency(availableAmount)} đ</span>
                          </p>
                        )
                      }
                      return null
                    })()}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phương thức thanh toán <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={paymentData.payment_method}
                      onChange={(e) =>
                        setPaymentData({
                          ...paymentData,
                          payment_method: e.target.value as 'cash' | 'bank_transfer' | 'other',
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="cash">Tiền mặt</option>
                      <option value="bank_transfer">Chuyển khoản</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ngày thanh toán <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={paymentData.payment_date}
                      onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                    <textarea
                      value={paymentData.notes}
                      onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Nhập ghi chú (tùy chọn)"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => {
                        setShowPaymentModal(false)
                        setSelectedDebt(null)
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSubmitPayment}
                      disabled={isSubmittingPayment}
                      className={`px-6 py-2 bg-primary-600 text-white rounded-lg transition ${
                        isSubmittingPayment
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-primary-700'
                      }`}
                    >
                      {isSubmittingPayment ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
                    </button>
                  </div>
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

