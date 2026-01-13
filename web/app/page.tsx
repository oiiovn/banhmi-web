'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import { authApi } from '@/lib/api/auth'
import { useCartStore } from '@/lib/store/cartStore'
import Image from 'next/image'
import CustomerHeader from '@/components/CustomerHeader'
import api from '@/lib/api'

interface Category {
  id: number
  name: string
  description: string | null
  image: string | null
}

interface Product {
  id: number
  name: string
  description: string | null
  price: string
  wholesale_price: string | null
  unit: string | null
  quantity_per_unit: string | null
  image: string | null
  category_id: number
  is_available: boolean
  agent?: {
    id: number
    name: string
  } | null
}

export default function Home() {
  const router = useRouter()
  const { user, isAuthenticated, viewMode, setViewMode } = useAuthStore()
  const { addItem, getItemCount } = useCartStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [isHydrated, setIsHydrated] = useState(false)
  const [pendingConfirmOrders, setPendingConfirmOrders] = useState<any[]>([])
  const [showNotification, setShowNotification] = useState(true)

  // Wait for auth store to hydrate from localStorage
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Redirect admin to admin dashboard
  useEffect(() => {
    if (isAuthenticated && user && user.role === 'admin') {
      router.push('/admin')
      return
    }
    // Agent can view customer home page - tự động chuyển sang customer mode nếu đang ở agent mode
    if (isAuthenticated && user && user.role === 'agent' && viewMode === 'agent') {
      setViewMode('customer')
    }
  }, [isAuthenticated, user, router, viewMode, setViewMode])

  useEffect(() => {
    fetchCategories()
    fetchProducts()
    // Refresh user data to get latest role
    if (isAuthenticated) {
      authApi.getCurrentUser().catch(console.error)
      fetchPendingConfirmOrders()
    }
  }, [isAuthenticated])

  const fetchPendingConfirmOrders = async () => {
    try {
      const response = await api.get('/orders', { params: { status: 'delivered_by_agent' } })
      if (response.data.success) {
        setPendingConfirmOrders(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching pending confirm orders:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      // Sử dụng api từ lib/api để tự động gửi token nếu có
      const response = await api.get('/categories')
      if (response.data.success) {
        setCategories(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchProducts = async (categoryId?: number) => {
    try {
      setLoading(true)
      const params = categoryId ? { category_id: categoryId } : {}
      // Sử dụng api từ lib/api để tự động gửi token nếu có
      const response = await api.get('/products', { params })
      if (response.data.success) {
        setProducts(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryClick = (categoryId: number | null) => {
    setSelectedCategory(categoryId)
    fetchProducts(categoryId || undefined)
  }

  const handleAddToCart = (product: Product) => {
    if (!product.is_available) return
    
    // Yêu cầu đăng nhập trước khi thêm vào giỏ hàng
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    
    addItem({
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      wholesale_price: product.wholesale_price,
      unit: product.unit,
      quantity_per_unit: product.quantity_per_unit,
      agent_id: product.agent?.id || null,
    })
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

  // Don't show customer home if user is admin (they will be redirected)
  if (isAuthenticated && user && user.role === 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerHeader />

      {/* Notification Banner - Đơn hàng chờ xác nhận */}
      {isAuthenticated && pendingConfirmOrders.length > 0 && showNotification && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="container mx-auto px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  <svg
                    className="w-4 h-4 text-yellow-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-yellow-900 line-clamp-2">
                    Bạn có {pendingConfirmOrders.length} đơn hàng đã giao đi. Hãy xác nhận đã nhận đơn hàng chưa?
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Link
                  href="/orders?status=delivered_by_agent"
                  className="px-2 py-1.5 bg-yellow-600 text-white rounded text-xs font-medium whitespace-nowrap"
                  onClick={() => setShowNotification(false)}
                >
                  Xem đơn
                </Link>
                <button
                  onClick={() => setShowNotification(false)}
                  className="text-yellow-600 hover:text-yellow-800 flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categories */}
      <section className="container mx-auto px-2 py-4 md:py-8">
        <h3 className="text-lg md:text-2xl font-bold mb-3 md:mb-4">Danh mục sản phẩm</h3>
        <div className="flex gap-2 md:gap-4 overflow-x-auto pb-2 md:pb-4 scrollbar-hide -mx-2 px-2">
          <button
            onClick={() => handleCategoryClick(null)}
            className={`px-3 py-1.5 md:px-6 md:py-3 rounded-lg whitespace-nowrap text-xs md:text-base font-medium transition-all flex-shrink-0 ${
              selectedCategory === null
                ? 'bg-primary-600 text-white shadow-lg scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-100 shadow'
            }`}
          >
            Tất cả
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              className={`px-3 py-1.5 md:px-6 md:py-3 rounded-lg whitespace-nowrap text-xs md:text-base font-medium transition-all flex-shrink-0 ${
                selectedCategory === category.id
                  ? 'bg-primary-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-100 shadow'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </section>

      {/* Products */}
      <section className="container mx-auto px-2 pb-20 md:pb-16">
        <div className="flex justify-between items-center mb-3 md:mb-4">
          <h3 className="text-lg md:text-2xl font-bold">Sản phẩm</h3>
          {selectedCategory && (
            <button
              onClick={() => handleCategoryClick(null)}
              className="text-primary-600 hover:text-primary-700 text-xs md:text-sm font-medium"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
        {loading ? (
          <div className="text-center py-8 md:py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-b-2 border-primary-600"></div>
            <p className="mt-3 md:mt-4 text-gray-500 text-sm md:text-base">Đang tải sản phẩm...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 md:py-16 bg-white rounded-lg shadow">
            <p className="text-gray-500 text-sm md:text-lg">Không có sản phẩm nào trong danh mục này</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2 md:gap-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-md shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 flex flex-col h-full"
              >
                <div className="relative w-full aspect-square bg-gray-100">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover rounded-t-md"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 rounded-t-md">
                      <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                  {!product.is_available && (
                    <div className="absolute top-0.5 right-0.5 bg-red-500 text-white px-1 py-0.5 rounded text-[9px] md:text-[10px] font-medium">
                      Hết
                    </div>
                  )}
                </div>
                <div className="p-1 md:p-1.5 flex flex-col flex-grow">
                  <h4 className="font-medium text-[11px] md:text-xs mb-0.5 text-gray-900 line-clamp-1 leading-tight">{product.name}</h4>
                  {product.agent && (
                    <p className="text-blue-600 text-[8px] md:text-[9px] mb-0.5 font-medium line-clamp-1">
                      Đại lý: {product.agent.name}
                    </p>
                  )}
                  {product.description && (
                    <p className="text-gray-600 text-[9px] md:text-[10px] mb-1 line-clamp-2 flex-grow leading-tight">
                      {product.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center mt-auto gap-1">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-primary-600 font-bold text-[11px] md:text-xs truncate">
                        {product.wholesale_price
                          ? parseFloat(product.wholesale_price).toLocaleString('vi-VN') + ' đ'
                          : product.price
                          ? parseFloat(product.price).toLocaleString('vi-VN') + ' đ'
                          : 'Liên hệ'}
                      </span>
                      {product.unit && (
                        <span className="text-gray-500 text-[9px] md:text-[10px] truncate">
                          {product.quantity_per_unit && parseFloat(product.quantity_per_unit) > 0
                            ? `${parseFloat(product.quantity_per_unit)} ${product.unit}`
                            : product.unit}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={!product.is_available}
                      className={`px-1.5 py-1 md:px-2 md:py-1.5 rounded text-[9px] md:text-[10px] font-medium transition flex-shrink-0 ${
                        product.is_available
                          ? 'bg-primary-600 text-white hover:bg-primary-700 active:scale-95'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {product.is_available ? (
                        <span className="flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                            />
                          </svg>
                          <span className="hidden sm:inline">Thêm</span>
                        </span>
                      ) : (
                        'Hết'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-6 md:py-12 mt-8 md:mt-16">
        <div className="container mx-auto px-2 md:px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            <div>
              <h3 className="text-base md:text-xl font-bold mb-2 md:mb-4">🍞 Banhmi</h3>
              <p className="text-gray-400 text-sm md:text-base">
                Đặt hàng bánh mì ngon, nhanh chóng và tiện lợi
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2 md:mb-4 text-sm md:text-base">Liên kết</h4>
              <ul className="space-y-1 md:space-y-2 text-gray-400 text-sm md:text-base">
                <li>
                  <Link href="/" className="hover:text-white">
                    Trang chủ
                  </Link>
                </li>
                <li>
                  <Link href="/register-agent" className="hover:text-white">
                    Đăng ký Đại lý
                  </Link>
                </li>
                <li>
                  <Link href="/orders" className="hover:text-white">
                    Đơn hàng
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 md:mb-4 text-sm md:text-base">Liên hệ</h4>
              <p className="text-gray-400 text-sm md:text-base">Email: support@banhmi.com</p>
              <p className="text-gray-400 text-sm md:text-base">Hotline: 1900-xxxx</p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-4 md:mt-8 pt-4 md:pt-8 text-center text-gray-400 text-xs md:text-sm">
            <p>&copy; 2024 Banhmi. Tất cả quyền được bảo lưu.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
