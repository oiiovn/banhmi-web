'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuthStore } from '@/lib/store/authStore'
import { useCartStore } from '@/lib/store/cartStore'
import CustomerHeader from '@/components/CustomerHeader'

export default function CartPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const { items, removeItem, updateQuantity, clearCart, getTotal, getItemCount } = useCartStore()
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, router])

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

  const handleQuantityChange = (productId: number, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(productId)
    } else {
      updateQuantity(productId, newQuantity)
    }
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString('vi-VN') + ' đ'
  }

  const formatUnit = (item: any) => {
    if (!item.unit) return ''
    if (item.quantity_per_unit && parseFloat(item.quantity_per_unit) > 0) {
      return `${parseFloat(item.quantity_per_unit)} ${item.unit}`
    }
    return item.unit
  }

  const formatQuantityWithUnit = (item: any) => {
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
    <div className="min-h-screen bg-gray-50">
      <CustomerHeader />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Giỏ hàng của tôi</h1>

        {items.length === 0 ? (
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
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Giỏ hàng trống</h2>
            <p className="text-gray-600 mb-6">Bạn chưa có sản phẩm nào trong giỏ hàng</p>
            <Link
              href="/"
              className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition font-medium"
            >
              Tiếp tục mua sắm
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {items.map((item) => {
                    const itemPrice = item.wholesale_price || item.price
                    const unitDisplay = formatUnit(item)
                    
                    return (
                      <div key={item.product_id} className="p-4">
                        <div className="flex gap-3">
                          {/* Product Image */}
                          <div className="flex-shrink-0">
                            {item.product_image ? (
                              <Image
                                src={item.product_image}
                                alt={item.product_name}
                                width={80}
                                height={80}
                                className="w-20 h-20 object-cover rounded-lg"
                              />
                            ) : (
                              <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                                <span className="text-3xl">🍞</span>
                              </div>
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="flex-grow min-w-0">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="text-base font-semibold text-gray-900 line-clamp-2">
                                {item.product_name}
                              </h3>
                              <button
                                onClick={() => removeItem(item.product_id)}
                                className="text-red-600 hover:text-red-700 text-sm font-medium ml-2 flex-shrink-0"
                              >
                                Xóa
                              </button>
                            </div>
                            
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg font-bold text-primary-600">
                                {formatPrice(itemPrice)}
                              </span>
                              {unitDisplay && (
                                <span className="text-xs text-gray-500">
                                  / {unitDisplay}
                                </span>
                              )}
                            </div>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-600">Số lượng:</span>
                              <div className="flex items-center gap-1 border border-gray-300 rounded-lg">
                                <button
                                  onClick={() => handleQuantityChange(item.product_id, item.quantity - 1)}
                                  className="px-2 py-1 text-gray-600 hover:bg-gray-100 transition text-sm"
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const newQuantity = parseInt(e.target.value) || 1
                                    handleQuantityChange(item.product_id, newQuantity)
                                  }}
                                  onBlur={(e) => {
                                    const value = parseInt(e.target.value)
                                    if (!value || value < 1) {
                                      handleQuantityChange(item.product_id, 1)
                                    }
                                  }}
                                  className="w-12 px-1 py-1 text-sm text-gray-900 font-medium text-center border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  onClick={() => handleQuantityChange(item.product_id, item.quantity + 1)}
                                  className="px-2 py-1 text-gray-600 hover:bg-gray-100 transition text-sm"
                                >
                                  +
                                </button>
                              </div>
                              {item.quantity_per_unit && parseFloat(item.quantity_per_unit) > 0 && item.unit && (
                                <span className="text-xs text-gray-600">
                                  = {formatQuantityWithUnit(item).split(' = ')[1]}
                                </span>
                              )}
                            </div>

                            {/* Subtotal */}
                            <div className="mt-2 text-right">
                              <span className="text-sm text-gray-600">Thành tiền: </span>
                              <span className="text-base font-bold text-gray-900">
                                {formatPrice(itemPrice * item.quantity)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-5 sticky top-24">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Tóm tắt đơn hàng</h2>
                
                <div className="space-y-3 mb-5">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Số lượng sản phẩm:</span>
                    <span className="font-medium">{getItemCount()}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between text-lg font-bold text-gray-900">
                      <span>Thành tiền:</span>
                      <span className="text-primary-600">{formatPrice(getTotal())}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Link
                    href="/checkout"
                    className="block w-full bg-primary-600 text-white text-center py-3 rounded-lg hover:bg-primary-700 transition font-medium"
                  >
                    Tiếp tục đặt hàng
                  </Link>
                  <button
                    onClick={clearCart}
                    className="block w-full bg-gray-200 text-gray-700 text-center py-3 rounded-lg hover:bg-gray-300 transition font-medium"
                  >
                    Xóa giỏ hàng
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

