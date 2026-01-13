'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store/authStore'
import { useCartStore } from '@/lib/store/cartStore'
import api from '@/lib/api'
import CustomerHeader from '@/components/CustomerHeader'

export default function CheckoutPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const { items, clearCart, getTotal } = useCartStore()
  const [formData, setFormData] = useState({
    delivery_address: user?.address || '',
    phone: user?.phone || '',
    notes: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    if (items.length === 0) {
      router.push('/')
      return
    }
  }, [isAuthenticated, items, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!formData.delivery_address.trim()) {
      setErrorMessage('Vui lòng nhập địa chỉ giao hàng')
      return
    }

    if (!formData.phone.trim()) {
      setErrorMessage('Vui lòng nhập số điện thoại')
      return
    }

    setIsSubmitting(true)

    try {
      // Nhóm items theo agent_id (null cũng là một nhóm)
      const itemsByAgent = items.reduce((acc, item) => {
        const agentKey = item.agent_id || 'no_agent'
        if (!acc[agentKey]) {
          acc[agentKey] = []
        }
        acc[agentKey].push({
          product_id: item.product_id,
          quantity: item.quantity,
        })
        return acc
      }, {} as Record<string | number, Array<{ product_id: number; quantity: number }>>)

      // Tạo đơn hàng cho từng đại lý
      const orderPromises = Object.entries(itemsByAgent).map(async ([agentKey, orderItems]) => {
        const response = await api.post('/orders', {
          items: orderItems,
          delivery_address: formData.delivery_address,
          phone: formData.phone,
          notes: formData.notes,
        })
        return response.data
      })

      const results = await Promise.all(orderPromises)
      
      // Kiểm tra xem tất cả đơn hàng đã được tạo thành công chưa
      const allSuccess = results.every((result) => result.success)
      
      if (allSuccess) {
        clearCart()
        router.push('/orders')
      } else {
        const failedCount = results.filter((r) => !r.success).length
        setErrorMessage(
          `Không thể tạo ${failedCount} đơn hàng. Vui lòng thử lại.`
        )
      }
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message || 'Không thể tạo đơn hàng. Vui lòng thử lại.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isAuthenticated || items.length === 0) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerHeader />

      <div className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">Thanh toán</h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-xl font-bold mb-4">Thông tin giao hàng</h3>
              <form onSubmit={handleSubmit}>
                {errorMessage && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                    {errorMessage}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Địa chỉ giao hàng *
                    </label>
                    <textarea
                      name="delivery_address"
                      value={formData.delivery_address}
                      onChange={handleChange}
                      rows={3}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Nhập địa chỉ đầy đủ"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Số điện thoại *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="0901234567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ghi chú (tùy chọn)
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Ghi chú cho đơn hàng"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50"
                  >
                    {isSubmitting ? 'Đang xử lý...' : 'Đặt hàng'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h3 className="text-xl font-bold mb-4">Đơn hàng</h3>
              
              {/* Thông báo về việc tách đơn hàng */}
              {(() => {
                const agents = new Set(items.map(item => item.agent_id).filter(Boolean))
                if (agents.size > 1) {
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-blue-800">
                        <span className="font-semibold">ℹ️ Lưu ý:</span> Giỏ hàng của bạn có sản phẩm từ {agents.size} đại lý khác nhau. 
                        Hệ thống sẽ tự động tách thành {agents.size} đơn hàng riêng biệt khi đặt hàng.
                      </p>
                    </div>
                  )
                }
                return null
              })()}
              
              <div className="space-y-3 mb-4">
                {items.map((item) => {
                  const itemPrice = item.wholesale_price || item.price
                  const formatQuantityWithUnit = () => {
                    if (!item.unit) return `${item.quantity}`
                    if (item.quantity_per_unit && parseFloat(item.quantity_per_unit) > 0) {
                      const quantityPerUnit = parseFloat(item.quantity_per_unit)
                      const totalQuantity = quantityPerUnit * item.quantity
                      // Loại bỏ .00 khỏi số lượng
                      const formatNumber = (num: number) => {
                        return num % 1 === 0 ? num.toString() : num.toFixed(2).replace(/\.?0+$/, '')
                      }
                      return `${formatNumber(quantityPerUnit)} × ${item.quantity} = ${formatNumber(totalQuantity)} ${item.unit}`
                    }
                    return `${item.quantity} ${item.unit}`
                  }
                  
                  return (
                    <div key={item.product_id} className="flex flex-col gap-1 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{item.product_name}</span>
                        <span className="font-medium">
                          {(itemPrice * item.quantity).toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>
                          Số lượng: {formatQuantityWithUnit()}
                        </span>
                        <span>
                          {itemPrice.toLocaleString('vi-VN')} đ{item.unit ? ` / ${item.quantity_per_unit && parseFloat(item.quantity_per_unit) > 0 ? (() => {
                            const qty = parseFloat(item.quantity_per_unit)
                            const formatted = qty % 1 === 0 ? qty.toString() : qty.toFixed(2).replace(/\.?0+$/, '')
                            return `${formatted} ${item.unit}`
                          })() : item.unit}` : ''}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Tổng cộng:</span>
                  <span className="text-primary-600">
                    {getTotal().toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

