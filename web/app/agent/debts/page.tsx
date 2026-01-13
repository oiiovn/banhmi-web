'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import { authApi } from '@/lib/api/auth'
import { agentApi, Debt, DebtStats, Payment } from '@/lib/api/agent'
import AgentHeader from '@/components/AgentHeader'
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

export default function AgentDebtsPage() {
  const router = useRouter()
  const { user, isAuthenticated, viewMode, setViewMode } = useAuthStore()
  const [debts, setDebts] = useState<Debt[]>([])
  const [stats, setStats] = useState<DebtStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renderError, setRenderError] = useState<Error | null>(null)
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([])
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

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [debtsRes, paymentsRes] = await Promise.all([
        agentApi.getDebts(selectedStatus || undefined),
        agentApi.getPendingPayments(),
      ])

      if (debtsRes.success) {
        setDebts(debtsRes.data || [])
        // Tính stats từ debts data nếu có
        if (debtsRes.stats) {
          setStats(debtsRes.stats)
        }
      } else {
        console.error('Failed to fetch debts:', debtsRes)
        setError('Không thể tải dữ liệu công nợ')
        setDebts([])
        setStats(null)
      }

      if (paymentsRes.success) {
        setPendingPayments(paymentsRes.data || [])
      }
    } catch (error: any) {
      console.error('Error fetching data:', error)
      setError(error?.message || 'Có lỗi xảy ra khi tải dữ liệu')
      setDebts([])
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    try {
      setIsHydrated(true)
    } catch (err) {
      console.error('Error in hydration:', err)
      setRenderError(err instanceof Error ? err : new Error('Lỗi khởi tạo trang'))
    }
  }, [])

  useEffect(() => {
    try {
      if (!isHydrated) return

      if (!isAuthenticated || !user || user.role !== 'agent') {
        router.push('/login')
        return
      }
      
      // Tự động chuyển sang agent mode khi vào trang agent
      if (viewMode !== 'agent') {
        setViewMode('agent')
      }
    } catch (err) {
      console.error('Error in auth check:', err)
      setRenderError(err instanceof Error ? err : new Error('Lỗi kiểm tra xác thực'))
    }
  }, [isHydrated, isAuthenticated, user, router, viewMode, setViewMode])

  useEffect(() => {
    try {
      if (!isHydrated || !isAuthenticated || !user || user.role !== 'agent') return

      authApi.getCurrentUser().catch((err) => {
        console.error('Error getting current user:', err)
        setError('Lỗi khi lấy thông tin người dùng: ' + (err?.message || 'Unknown error'))
      })
      fetchData()
    } catch (err) {
      console.error('Error in data fetch effect:', err)
      setRenderError(err instanceof Error ? err : new Error('Lỗi tải dữ liệu'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, isAuthenticated, user?.id, selectedStatus])

  // Error boundary for render errors - must be after all hooks
  if (renderError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AgentHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">Lỗi hiển thị trang</h2>
            <p className="text-red-700 mb-4">{renderError.message}</p>
            <pre className="bg-red-100 p-4 rounded text-xs overflow-auto max-h-64">
              {renderError.stack}
            </pre>
            <button
              onClick={() => {
                setRenderError(null)
                window.location.reload()
              }}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleConfirmPayment = async (paymentId: number) => {
    setModal({
      isOpen: true,
      type: 'confirm',
      title: 'Xác nhận thanh toán',
      message: 'Bạn có chắc chắn đã nhận được khoản thanh toán này?',
      onConfirm: async () => {
        try {
          const response = await agentApi.confirmPayment(paymentId)
          if (response.success) {
            setModal({
              isOpen: true,
              type: 'alert',
              title: 'Thành công',
              message: 'Đã xác nhận thanh toán thành công!',
            })
            fetchData()
          }
        } catch (error: any) {
          setModal({
            isOpen: true,
            type: 'alert',
            title: 'Lỗi',
            message: 'Không thể xác nhận thanh toán: ' + (error.response?.data?.message || error.message),
          })
        }
      },
    })
  }

  const handleRejectPayment = async (paymentId: number) => {
    setModal({
      isOpen: true,
      type: 'confirm',
      title: 'Từ chối thanh toán',
      message: 'Bạn có chắc chắn muốn từ chối khoản thanh toán này?',
      onConfirm: async () => {
        try {
          const response = await agentApi.rejectPayment(paymentId)
          if (response.success) {
            setModal({
              isOpen: true,
              type: 'alert',
              title: 'Thành công',
              message: 'Đã từ chối thanh toán!',
            })
            fetchData()
          }
        } catch (error: any) {
          setModal({
            isOpen: true,
            type: 'alert',
            title: 'Lỗi',
            message: 'Không thể từ chối thanh toán: ' + (error.response?.data?.message || error.message),
          })
        }
      },
    })
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

  if (loading && debts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AgentHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
            <p className="text-gray-600">Đang tải...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AgentHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quản lý công nợ</h1>
          <p className="text-gray-600">Theo dõi và quản lý công nợ của khách hàng</p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800 mb-1">Lỗi tải dữ liệu</h3>
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={fetchData}
                  className="mt-3 text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Thử lại
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending Payments Section */}
        {pendingPayments.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-yellow-900 mb-4">
              Thanh toán chờ xác nhận ({pendingPayments.length})
            </h2>
            <div className="space-y-4">
              {pendingPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="bg-white rounded-lg shadow p-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium">
                          Chờ xác nhận
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Khách hàng:</span> {payment.customer?.name || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Số tiền:</span>{' '}
                        <span className="text-lg font-bold text-primary-600">
                          {formatCurrency(payment.amount)} đ
                        </span>
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Phương thức:</span>{' '}
                        {payment.payment_method === 'cash' ? 'Tiền mặt' :
                         payment.payment_method === 'bank_transfer' ? 'Chuyển khoản' : 'Khác'}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Ngày thanh toán:</span> {formatDate(payment.payment_date)}
                      </p>
                      {payment.notes && (
                        <p className="text-sm text-gray-600 mb-1">
                          <span className="font-medium">Ghi chú:</span> {payment.notes}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        Ngày tạo: {new Date(payment.created_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleConfirmPayment(payment.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm"
                      >
                        Xác nhận
                      </button>
                      <button
                        onClick={() => handleRejectPayment(payment.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm"
                      >
                        Từ chối
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debts Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
            <p className="text-gray-600">Đang tải...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Thử lại
            </button>
          </div>
        ) : debts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600">Không có công nợ nào</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Khách hàng
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
                      {debt.customer?.name || '-'}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={async () => {
                          try {
                            const response = await agentApi.getDebt(debt.id)
                            if (response.success) {
                              // Backend returns debt_orders (snake_case), convert to debtOrders (camelCase)
                              const debtData = {
                                ...response.data,
                                debtOrders: response.data.debt_orders || response.data.debtOrders || [],
                              }
                              console.log('Debt details:', debtData)
                              console.log('DebtOrders:', debtData.debtOrders)
                              setSelectedDebt(debtData)
                            }
                          } catch (error) {
                            console.error('Error fetching debt details:', error)
                            // Fallback to using debt from list
                            setSelectedDebt(debt)
                          }
                        }}
                        className="text-primary-600 hover:text-primary-800 font-medium"
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Debt Detail Modal */}
      {selectedDebt && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setSelectedDebt(null)}
            ></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-gray-900">Chi tiết công nợ #{selectedDebt.id}</h3>
                  <button
                    onClick={() => setSelectedDebt(null)}
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
                  {/* Debt Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Thông tin công nợ</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Khách hàng:</span> {selectedDebt.customer?.name || '-'}
                      </div>
                      {selectedDebt.debtOrders && selectedDebt.debtOrders.length > 0 && (
                        <div className="col-span-2">
                          <span className="font-medium">Số đơn hàng:</span> {selectedDebt.debtOrders.length} đơn
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Tổng tiền:</span>{' '}
                        <span className="font-bold">{formatCurrency(selectedDebt.total_amount)} đ</span>
                      </div>
                      <div>
                        <span className="font-medium">Đã thanh toán:</span>{' '}
                        <span className="text-green-600 font-bold">
                          {formatCurrency(selectedDebt.paid_amount)} đ
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Còn lại:</span>{' '}
                        <span className="text-red-600 font-bold">
                          {formatCurrency(selectedDebt.remaining_amount)} đ
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Trạng thái:</span>{' '}
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
                  {((selectedDebt.debtOrders && selectedDebt.debtOrders.length > 0) || (selectedDebt.order_id && (!selectedDebt.debtOrders || selectedDebt.debtOrders.length === 0))) && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">
                        {selectedDebt.debtOrders && selectedDebt.debtOrders.length > 0
                          ? `Lịch sử gộp công nợ - Danh sách đơn hàng (${selectedDebt.debtOrders.length} đơn)`
                          : 'Thông tin đơn hàng'}
                      </h4>
                      {selectedDebt.debtOrders && selectedDebt.debtOrders.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                          <p className="text-sm text-blue-800">
                            <span className="font-semibold">💡 Lưu ý:</span> Các đơn hàng này đã được tự động gộp vào công nợ tổng khi khách hàng xác nhận nhận hàng.
                          </p>
                        </div>
                      )}
                      <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="max-h-[200px] overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Mã đơn hàng
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Ngày đặt hàng
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Ngày gộp vào công nợ
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
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
                                <tr key={debtOrder.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    #{debtOrder.order_id}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    {debtOrder.order?.created_at
                                      ? new Date(debtOrder.order.created_at).toLocaleDateString('vi-VN', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                        })
                                      : '-'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
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
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {formatCurrency(debtOrder.amount)} đ
                                  </td>
                                </tr>
                              ))
                            ) : selectedDebt.order_id ? (
                              // Single order debt (old data)
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                  #{selectedDebt.order_id}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {selectedDebt.order?.created_at
                                    ? new Date(selectedDebt.order.created_at).toLocaleDateString('vi-VN', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                      })
                                    : selectedDebt.created_at
                                    ? new Date(selectedDebt.created_at).toLocaleDateString('vi-VN', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                      })
                                    : '-'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
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
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
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
                      <h4 className="font-semibold text-gray-900 mb-3">Lịch sử thanh toán</h4>
                      <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="max-h-[200px] overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Ngày
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Số tiền
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Phương thức
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Trạng thái
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Ghi chú
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
                              .map((payment) => {
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
                                return (
                              <tr 
                                key={payment.id}
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={() => router.push(`/payments?id=${payment.id}`)}
                              >
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {formatDate(payment.payment_date)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                                  {formatCurrency(payment.amount)} đ
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {payment.payment_method === 'cash'
                                    ? 'Tiền mặt'
                                    : payment.payment_method === 'bank_transfer'
                                    ? 'Chuyển khoản'
                                    : 'Khác'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex flex-col gap-1">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
                                      {statusInfo.label}
                                    </span>
                                    {statusInfo.by && (
                                      <span className="text-xs text-gray-500">
                                        {statusInfo.by}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">{payment.notes || '-'}</td>
                              </tr>
                            )})}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
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

