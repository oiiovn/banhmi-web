'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import { authApi } from '@/lib/api/auth'
import Modal from '@/components/Modal'

export default function RefreshUserPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
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
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    const refresh = async () => {
      try {
        await authApi.getCurrentUser()
        setModal({
          isOpen: true,
          type: 'alert',
          title: 'Thành công',
          message: 'Đã cập nhật thông tin tài khoản!',
        })
        setTimeout(() => router.push('/'), 1500)
      } catch (error) {
        console.error('Error refreshing user:', error)
        setModal({
          isOpen: true,
          type: 'alert',
          title: 'Lỗi',
          message: 'Không thể cập nhật thông tin. Vui lòng đăng xuất và đăng nhập lại.',
        })
        setTimeout(() => router.push('/'), 2000)
      }
    }

    refresh()
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
        <p className="text-gray-600">Đang cập nhật thông tin tài khoản...</p>
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

