'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import { useCartStore } from '@/lib/store/cartStore'

export default function CustomerHeader() {
  const router = useRouter()
  const { user, isAuthenticated, logout, viewMode, setViewMode } = useAuthStore()
  const { getItemCount } = useCartStore()
  const [isHydrated, setIsHydrated] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  // Nếu đang ở chế độ agent view, không hiển thị customer header
  if (isAuthenticated && user && user.role === 'agent' && viewMode === 'agent') {
    return null
  }

  const handleSwitchToAgent = () => {
    setViewMode('agent')
    router.push('/agent')
  }

  if (!isHydrated) {
    return null
  }

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl">🍞</span>
            <h1 className="text-2xl font-bold text-primary-600">Banhmi</h1>
          </Link>
          <nav className="flex gap-4 items-center">
            {isAuthenticated && user ? (
              <>
                {/* Desktop View - Hiển thị đầy đủ */}
                <div className="hidden md:flex items-center gap-4">
                  <Link
                    href="/orders"
                    className="text-gray-700 hover:text-primary-600 text-sm font-medium"
                  >
                    Đơn hàng của tôi
                  </Link>
                  <Link
                    href="/debts"
                    className="text-gray-700 hover:text-primary-600 text-sm font-medium"
                  >
                    Công nợ
                  </Link>
                  <Link
                    href="/cart"
                    className="relative text-gray-700 hover:text-primary-600"
                  >
                    <svg
                      className="w-6 h-6"
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
                    {getItemCount() > 0 && (
                      <span className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {getItemCount()}
                      </span>
                    )}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{user.name}</span>
                    <span className="text-xs text-gray-500">(Khách hàng)</span>
                  </div>
                  {user.role === 'agent' && (
                    <button
                      onClick={handleSwitchToAgent}
                      className="px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition"
                    >
                      Chuyển sang Đại lý
                    </button>
                  )}
                  <button
                    onClick={logout}
                    className="text-gray-700 hover:text-primary-600 text-sm font-medium"
                  >
                    Đăng xuất
                  </button>
                </div>

                {/* Mobile View - Dropdown menu */}
                <div className="md:hidden flex items-center gap-3 relative" ref={dropdownRef}>
                  <Link
                    href="/cart"
                    className="relative text-gray-700 hover:text-primary-600"
                  >
                    <svg
                      className="w-6 h-6"
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
                    {getItemCount() > 0 && (
                      <span className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {getItemCount()}
                      </span>
                    )}
                  </Link>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary-600"
                  >
                    <span>{user.name}</span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
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
                  {isDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      <Link
                        href="/orders"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        Đơn hàng của tôi
                      </Link>
                      <Link
                        href="/debts"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        Công nợ
                      </Link>
                      {user.role === 'agent' && (
                        <button
                          onClick={() => {
                            handleSwitchToAgent()
                            setIsDropdownOpen(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-gray-100 font-medium"
                        >
                          Chuyển sang Đại lý
                        </button>
                      )}
                      <button
                        onClick={() => {
                          logout()
                          setIsDropdownOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex gap-4">
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-primary-600 text-sm font-medium"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}

