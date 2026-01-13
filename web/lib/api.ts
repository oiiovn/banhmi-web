import axios from 'axios'

// Auto-detect API URL based on environment (runtime detection)
const getApiUrl = (): string => {
  // Priority 1: Environment variable (build time)
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  
  // Priority 2: Auto-detect production based on hostname (client-side only)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    // If not localhost, use production API
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('192.168.') && hostname !== '') {
      return 'https://api.websi.vn/api'
    }
  }
  
  // Priority 3: Check if we're on production domain
  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    if (origin.includes('websi.vn') || origin.includes('api.websi.vn')) {
      return 'https://api.websi.vn/api'
    }
  }
  
  // Default to localhost for development
  return 'http://localhost:8000/api'
}

// Create axios instance with dynamic baseURL
const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add token and update baseURL dynamically
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      // Re-evaluate API URL on each request to ensure it's always correct
      config.baseURL = getApiUrl()
      
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    // Don't set Content-Type for FormData - let axios set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear auth and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
        // Clear auth storage
        localStorage.removeItem('auth-storage')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

