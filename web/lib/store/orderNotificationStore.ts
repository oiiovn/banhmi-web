import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OrderNotificationState {
  viewedOrders: Record<number, string> // order_id -> thời gian xem chi tiết lần cuối
  markOrderAsViewed: (orderId: number) => void
  markAllOrdersAsViewed: (orderIds: number[]) => void
  isOrderViewed: (orderId: number, orderUpdatedAt: string) => boolean
  getUnreadCount: (orders: Array<{ id: number; status: string; updated_at: string }>) => number
  reset: () => void
}

// Export để dùng ở nơi khác
export const STATUSES_TO_TRACK = ['pending', 'confirmed', 'preparing', 'ready', 'delivered_by_agent']
// Không track 'delivered' và 'cancelled'

export const useOrderNotificationStore = create<OrderNotificationState>()(
  persist(
    (set, get) => ({
      viewedOrders: {}, // { orderId: viewedAt }

      markOrderAsViewed: (orderId: number) => {
        set((state) => {
          return {
            viewedOrders: {
              ...state.viewedOrders,
              [orderId]: new Date().toISOString(),
            },
          }
        })
      },

      markAllOrdersAsViewed: (orderIds: number[]) => {
        set((state) => {
          const now = new Date().toISOString()
          const newViewedOrders = { ...state.viewedOrders }
          
          // Đánh dấu tất cả các đơn hàng là đã xem với thời gian hiện tại
          orderIds.forEach((orderId) => {
            newViewedOrders[orderId] = now
          })
          
          return {
            viewedOrders: newViewedOrders,
          }
        })
      },

      isOrderViewed: (orderId: number, orderUpdatedAt: string) => {
        const { viewedOrders } = get()
        const viewedAt = viewedOrders[orderId]
        
        // Nếu chưa xem bao giờ
        if (!viewedAt) return false
        
        // Nếu đã xem, kiểm tra xem đơn hàng có được cập nhật sau lần xem không
        const viewedTime = new Date(viewedAt).getTime()
        const updatedTime = new Date(orderUpdatedAt).getTime()
        
        // Nếu đơn hàng được cập nhật sau lần xem → chưa xem (cần xem lại)
        return updatedTime <= viewedTime
      },

      getUnreadCount: (orders: Array<{ id: number; status: string; updated_at: string }>) => {
        const { viewedOrders } = get()
        
        // Đếm các đơn hàng có trạng thái thay đổi và chưa xem chi tiết
        const unreadOrders = orders.filter((order) => {
          // Chỉ đếm các status cần track
          if (!STATUSES_TO_TRACK.includes(order.status)) return false
          
          // Kiểm tra xem đơn hàng đã được xem chưa
          const viewedAt = viewedOrders[order.id]
          
          // Nếu chưa xem bao giờ → chưa đọc
          if (!viewedAt) return true
          
          // Nếu đã xem, kiểm tra xem đơn hàng có được cập nhật sau lần xem không
          const viewedTime = new Date(viewedAt).getTime()
          const updatedTime = new Date(order.updated_at).getTime()
          
          // Nếu đơn hàng được cập nhật sau lần xem → chưa đọc (cần xem lại)
          return updatedTime > viewedTime
        })
        
        // Đếm số đơn hàng chưa xem (không phải số status)
        return unreadOrders.length
      },

      reset: () => {
        set({
          viewedOrders: {},
        })
      },
    }),
    {
      name: 'order-notifications',
    }
  )
)

