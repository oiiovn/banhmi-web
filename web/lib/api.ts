import axios from 'axios'

// Auto-detect API URL based on environment (runtime detection)
const getApiUrl = (): string => {
  // Auto-detect production based on hostname (client-side only)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    // If not localhost, use production API
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('192.168.')) {
      return 'https://api.websi.vn/api'
    }
  }
  
  // If environment variable is set (build time), use it
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
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

