/**
 * Configuration utilities
 * Centralized configuration for the application
 */

/**
 * Auto-detect API URL based on environment
 */
const detectApiUrl = (): string => {
  // If environment variable is set, use it
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  
  // Auto-detect production based on hostname (client-side only)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    // If not localhost, use production API
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('192.168.')) {
      return 'https://api.websi.vn/api'
    }
  }
  
  // Default to localhost for development
  return 'http://localhost:8000/api'
}

/**
 * Get API base URL (without /api suffix)
 */
export const getApiBaseUrl = (): string => {
  const apiUrl = detectApiUrl()
  return apiUrl.replace('/api', '')
}

/**
 * Get API full URL (with /api suffix)
 */
export const getApiUrl = (): string => {
  return detectApiUrl()
}

/**
 * Check if running in production
 */
export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production'
}

/**
 * Get image domains from environment
 */
export const getImageDomains = (): string[] => {
  const domains = process.env.NEXT_PUBLIC_IMAGE_DOMAINS
  if (domains) {
    return domains.split(',').map(d => d.trim())
  }
  return ['localhost']
}

