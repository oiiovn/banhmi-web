const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export cho LiteSpeed hosting (không cần Node.js)
  output: 'export',
  images: {
    unoptimized: true, // Cần cho static export
    domains: [
      'localhost',
      ...(process.env.NEXT_PUBLIC_IMAGE_DOMAINS 
        ? process.env.NEXT_PUBLIC_IMAGE_DOMAINS.split(',') 
        : [])
    ],
  },
  trailingSlash: true, // Giúp routing tốt hơn với static export
}

module.exports = withPWA(nextConfig)

