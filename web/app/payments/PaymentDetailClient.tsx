'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import { customerApi } from '@/lib/api/customer'
import { Payment } from '@/lib/api/agent'
import CustomerHeader from '@/components/CustomerHeader'
import Modal from '@/components/Modal'

const STATUS_COLORS: Record<string, string> = {
  pending_confirmation: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  pending_confirmation: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  rejected: 'Đã từ chối',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  other: 'Khác',
}

export default function PaymentDetailClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentId = searchParams.get('id') || ''
  const { user, isAuthenticated } = useAuthStore()
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
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

    if (!isAuthenticated || !user) {
      router.push('/login')
      return
    }

    if (user.role === 'admin') {
      router.push('/admin')
      return
    }

    if (!paymentId) {
      router.push('/debts')
      return
    }

    fetchPaymentDetails()
  }, [isHydrated, isAuthenticated, user, paymentId])

  const fetchPaymentDetails = async () => {
    try {
      setLoading(true)
      const id = parseInt(paymentId, 10)
      if (isNaN(id)) {
        setModal({
          isOpen: true,
          type: 'alert',
          title: 'Lỗi',
          message: 'ID thanh toán không hợp lệ',
        })
        router.push('/debts')
        return
      }

      const response = await customerApi.getPayment(id)
      if (response.success) {
        setPayment(response.data)
      } else {
        setModal({
          isOpen: true,
          type: 'alert',
          title: 'Lỗi',
          message: 'Không thể tải thông tin thanh toán',
        })
        router.push('/debts')
      }
    } catch (error: any) {
      console.error('Error fetching payment details:', error)
      setModal({
        isOpen: true,
        type: 'alert',
        title: 'Lỗi',
        message: 'Không thể tải thông tin thanh toán: ' + (error.response?.data?.message || error.message),
      })
      router.push('/debts')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: string | number): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('vi-VN').format(num)
  }

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <CustomerHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
            <p className="text-gray-600">Đang tải thông tin thanh toán...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="min-h-screen bg-gray-50">
        <CustomerHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600">Không tìm thấy thông tin thanh toán</p>
            <button
              onClick={() => router.push('/debts')}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              Quay lại công nợ
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerHeader />

      <div className="container mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => {
              // Quay lại trang công nợ với paymentId để highlight
              if (payment.debt_id) {
                router.push(`/debts?debtId=${payment.debt_id}&paymentId=${payment.id}`)
              } else {
                router.back()
              }
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span>Quay lại</span>
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Chi tiết thanh toán</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Info Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3">Thông tin thanh toán</h2>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs md:text-sm font-medium text-gray-500 whitespace-nowrap">Mã thanh toán:</span>
                  <span className="text-xs md:text-sm font-semibold text-gray-900">#{payment.id}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs md:text-sm font-medium text-gray-500 whitespace-nowrap">Số tiền:</span>
                  <span className="text-sm md:text-lg font-bold text-green-600 whitespace-nowrap">{formatCurrency(payment.amount)} đ</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs md:text-sm font-medium text-gray-500 whitespace-nowrap">Phương thức:</span>
                  <span className="text-xs md:text-sm text-gray-900 whitespace-nowrap">
                    {PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs md:text-sm font-medium text-gray-500 whitespace-nowrap">Ngày thanh toán:</span>
                  <span className="text-xs md:text-sm text-gray-900 whitespace-nowrap">{formatDate(payment.payment_date)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs md:text-sm font-medium text-gray-500 whitespace-nowrap">Trạng thái:</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] md:text-xs font-semibold rounded-full whitespace-nowrap ${
                      STATUS_COLORS[payment.status || 'pending_confirmation'] ||
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {STATUS_LABELS[payment.status || 'pending_confirmation'] || payment.status}
                  </span>
                </div>
                {payment.notes && (
                  <div className="pt-2">
                    <span className="text-xs md:text-sm font-medium text-gray-500 block mb-1.5">Ghi chú:</span>
                    <p className="text-xs md:text-sm text-gray-900 bg-gray-50 rounded-lg p-2 md:p-3">{payment.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status History */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3">Lịch sử trạng thái</h2>
              <div className="space-y-3">
                {/* Created */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs md:text-sm font-medium text-gray-900 whitespace-nowrap">Tạo thanh toán</span>
                      <span className="text-[10px] md:text-xs text-gray-500 whitespace-nowrap">{formatDate(payment.created_at)}</span>
                    </div>
                    <p className="text-[10px] md:text-xs text-gray-600">
                      Thanh toán được tạo bởi {payment.customer?.name || 'Khách hàng'}
                    </p>
                  </div>
                </div>

                {/* Status changes */}
                {payment.status === 'confirmed' && payment.confirmed_at && (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500 mt-1.5"></div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs md:text-sm font-medium text-gray-900 whitespace-nowrap">Đã xác nhận</span>
                        <span className="text-[10px] md:text-xs text-gray-500 whitespace-nowrap">{formatDate(payment.confirmed_at)}</span>
                      </div>
                      {payment.confirmedBy && (
                        <p className="text-[10px] md:text-xs text-gray-600 truncate">
                          Xác nhận bởi {payment.confirmedBy.name} ({payment.confirmedBy.email})
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {payment.status === 'rejected' && payment.confirmed_at && (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500 mt-1.5"></div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs md:text-sm font-medium text-gray-900 whitespace-nowrap">Đã từ chối</span>
                        <span className="text-[10px] md:text-xs text-gray-500 whitespace-nowrap">{formatDate(payment.confirmed_at)}</span>
                      </div>
                      {payment.confirmedBy && (
                        <p className="text-[10px] md:text-xs text-gray-600 truncate">
                          Từ chối bởi {payment.confirmedBy.name} ({payment.confirmedBy.email})
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {payment.status === 'pending_confirmation' && (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-yellow-500 mt-1.5"></div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs md:text-sm font-medium text-gray-900 whitespace-nowrap">Chờ xác nhận</span>
                        <span className="text-[10px] md:text-xs text-gray-500 whitespace-nowrap">Đang chờ đại lý xác nhận</span>
                      </div>
                      <p className="text-[10px] md:text-xs text-gray-600 truncate">
                        Thanh toán đang chờ đại lý {payment.agent?.name || ''} xác nhận
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 md:space-y-6">
            {/* Debt Info */}
            {payment.debt && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3">Thông tin công nợ</h2>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] md:text-xs font-medium text-gray-500 whitespace-nowrap">Mã công nợ:</span>
                    <p className="text-xs md:text-sm font-semibold text-gray-900 whitespace-nowrap">#{payment.debt.id}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] md:text-xs font-medium text-gray-500 whitespace-nowrap">Tổng tiền:</span>
                    <p className="text-xs md:text-sm font-semibold text-gray-900 whitespace-nowrap">
                      {formatCurrency(payment.debt.total_amount)} đ
                    </p>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] md:text-xs font-medium text-gray-500 whitespace-nowrap">Đã thanh toán:</span>
                    <p className="text-xs md:text-sm font-semibold text-green-600 whitespace-nowrap">
                      {formatCurrency(payment.debt.paid_amount)} đ
                    </p>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] md:text-xs font-medium text-gray-500 whitespace-nowrap">Còn lại:</span>
                    <p className="text-xs md:text-sm font-semibold text-red-600 whitespace-nowrap">
                      {formatCurrency(payment.debt.remaining_amount)} đ
                    </p>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] md:text-xs font-medium text-gray-500 whitespace-nowrap">Trạng thái:</span>
                    <p className="text-xs md:text-sm font-semibold text-gray-900 whitespace-nowrap">
                      {payment.debt.status === 'pending'
                        ? 'Chưa thanh toán'
                        : payment.debt.status === 'partial'
                        ? 'Thanh toán một phần'
                        : payment.debt.status === 'paid'
                        ? 'Đã thanh toán'
                        : payment.debt.status}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/debts?debtId=${payment.debt_id}&paymentId=${payment.id}`)}
                    className="w-full mt-3 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    Xem chi tiết công nợ
                  </button>
                </div>
              </div>
            )}

            {/* Agent Info */}
            {payment.agent && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3">Đại lý</h2>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] md:text-xs font-medium text-gray-500 whitespace-nowrap">Tên:</span>
                    <p className="text-xs md:text-sm text-gray-900 truncate ml-2">{payment.agent.name}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] md:text-xs font-medium text-gray-500 whitespace-nowrap">Email:</span>
                    <p className="text-xs md:text-sm text-gray-900 truncate ml-2">{payment.agent.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Info */}
            {payment.customer && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3">Khách hàng</h2>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] md:text-xs font-medium text-gray-500 whitespace-nowrap">Tên:</span>
                    <p className="text-xs md:text-sm text-gray-900 truncate ml-2">{payment.customer.name}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] md:text-xs font-medium text-gray-500 whitespace-nowrap">Email:</span>
                    <p className="text-xs md:text-sm text-gray-900 truncate ml-2">{payment.customer.email}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
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

