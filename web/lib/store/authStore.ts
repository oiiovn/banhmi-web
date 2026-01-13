import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface User {
  id: number
  name: string
  email: string
  phone?: string
  address?: string
  role: 'admin' | 'agent' | 'customer'
  is_active: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  _hasHydrated: boolean
  viewMode: 'agent' | 'customer' // Chế độ xem: 'agent' hoặc 'customer'
  setHasHydrated: (state: boolean) => void
  setViewMode: (mode: 'agent' | 'customer') => void
  login: (token: string, user: User) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,
      viewMode: 'customer', // Mặc định là customer
      setHasHydrated: (state: boolean) => {
        set({
          _hasHydrated: state,
        })
      },
      setViewMode: (mode: 'agent' | 'customer') => {
        set({
          viewMode: mode,
        })
      },
      login: (token: string, user: User) => {
        // Nếu user là agent, mặc định viewMode là 'agent'
        const defaultViewMode = user.role === 'agent' ? 'agent' : 'customer'
        set({
          token,
          user,
          isAuthenticated: true,
          viewMode: defaultViewMode,
        })
        // Store token in localStorage for axios interceptor
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token)
        }
      },
      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          viewMode: 'customer',
        })
        // Remove token from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token')
        }
      },
      updateUser: (user: Partial<User>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...user } : null,
        }))
      },
      refreshUser: async () => {
        // This will be called from authApi.getCurrentUser
        // The actual API call is in authApi.getCurrentUser
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        viewMode: state.viewMode,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

// Hook to check if store has hydrated
export const useAuthHydrated = () => {
  const store = useAuthStore()
  return store._hasHydrated
}

