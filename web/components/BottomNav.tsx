'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store/authStore'
import { useCartStore } from '@/lib/store/cartStore'
import { useOrderNotificationStore } from '@/lib/store/orderNotificationStore'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

export default function BottomNav() {
  const pathname = usePathname()
  const { isAuthenticated, user, viewMode } = useAuthStore()
  const { getItemCount } = useCartStore()
  const { getUnreadCount, viewedOrders } = useOrderNotificationStore()
  const [unreadOrderCount, setUnreadOrderCount] = useState(0)
  const [orders, setOrders] = useState<any[]>([])

  // Fetch orders để tính unread count - Phải đặt trước các early returns
  useEffect(() => {
    if (!isAuthenticated || viewMode === 'agent') {
      setUnreadOrderCount(0)
      setOrders([])
      return
    }

    const fetchOrdersForNotification = async () => {
      try {
        const response = await api.get('/orders')
        if (response.data.success) {
          const fetchedOrders = response.data.data
          setOrders(fetchedOrders)
          const count = getUnreadCount(fetchedOrders)
          setUnreadOrderCount(count)
        }
      } catch (error) {
        console.error('Error fetching orders for notification:', error)
      }
    }

    fetchOrdersForNotification()
    // Refresh mỗi 30 giây
    const interval = setInterval(fetchOrdersForNotification, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated, viewMode, getUnreadCount, pathname])

  // Cập nhật badge ngay khi có đơn hàng được đánh dấu đã xem hoặc thay đổi trạng thái
  useEffect(() => {
    if (orders.length > 0) {
      const count = getUnreadCount(orders)
      setUnreadOrderCount(count)
    }
  }, [viewedOrders, orders, getUnreadCount])

  // Chỉ hiển thị trên mobile và khi không phải agent view
  if (viewMode === 'agent' || !isAuthenticated) {
    return null
  }

  // Ẩn trên các trang không cần bottom nav
  const hiddenPaths = ['/login', '/register', '/register-agent', '/checkout', '/admin']
  if (hiddenPaths.some((path) => pathname.startsWith(path))) {
    return null
  }

  const navItems = [
    {
      href: '/',
      label: 'Trang chủ',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      href: '/orders',
      label: 'Đơn hàng',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
      badge: unreadOrderCount > 0 ? unreadOrderCount : undefined,
    },
    {
      href: '/cart',
      label: 'Giỏ hàng',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      badge: getItemCount() > 0 ? getItemCount() : undefined,
    },
    {
      href: '/debts',
      label: 'Công nợ',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:hidden safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          // Kiểm tra active state: exact match hoặc pathname bắt đầu với href (cho các route con)
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full relative ${
                isActive ? 'text-primary-600' : 'text-gray-500'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.badge && item.badge > 0 && (
                  <span className={`absolute -top-2 -right-2 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                    item.href === '/orders' ? 'bg-red-600' : 'bg-primary-600'
                  }`}>
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

