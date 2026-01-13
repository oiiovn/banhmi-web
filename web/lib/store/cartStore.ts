import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface CartItem {
  product_id: number
  product_name: string
  product_image: string | null
  price: number
  wholesale_price: number | null
  unit: string | null
  quantity_per_unit: string | null
  quantity: number
  agent_id: number | null
}

interface CartState {
  items: CartItem[]
  addItem: (product: { 
    id: number
    name: string
    image: string | null
    price: string
    wholesale_price: string | null
    unit: string | null
    quantity_per_unit: string | null
    agent_id?: number | null
  }, quantity?: number) => void
  removeItem: (productId: number) => void
  updateQuantity: (productId: number, quantity: number) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, quantity = 1) => {
        set((state) => {
          const existingItem = state.items.find((item) => item.product_id === product.id)
          const price = product.wholesale_price 
            ? parseFloat(product.wholesale_price) 
            : parseFloat(product.price)
          
          if (existingItem) {
            return {
              items: state.items.map((item) =>
                item.product_id === product.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            }
          }
          return {
            items: [
              ...state.items,
              {
                product_id: product.id,
                product_name: product.name,
                product_image: product.image,
                price: parseFloat(product.price),
                wholesale_price: product.wholesale_price ? parseFloat(product.wholesale_price) : null,
                unit: product.unit,
                quantity_per_unit: product.quantity_per_unit,
                quantity,
                agent_id: product.agent_id || null,
              },
            ],
          }
        })
      },
      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((item) => item.product_id !== productId),
        }))
      },
      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.product_id === productId ? { ...item, quantity } : item
          ),
        }))
      },
      clearCart: () => {
        set({ items: [] })
      },
      getTotal: () => {
        return get().items.reduce((total, item) => {
          const itemPrice = item.wholesale_price || item.price
          // Giá là giá cho 1 quantity_per_unit (nếu có) hoặc 1 đơn vị (nếu không có)
          // Ví dụ: 35.000 đ/100 Cái, quantity = 2 → 35.000 × 2 = 70.000 đ
          return total + itemPrice * item.quantity
        }, 0)
      },
      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0)
      },
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

