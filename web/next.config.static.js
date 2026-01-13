// File này dùng cho static export (shared hosting không có Node.js)
// Copy nội dung này vào next.config.js và uncomment output: 'export'

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // Static export cho shared hosting
  images: {
    unoptimized: true, // Cần cho static export
    domains: [
      'localhost',
      ...(process.env.NEXT_PUBLIC_IMAGE_DOMAINS 
        ? process.env.NEXT_PUBLIC_IMAGE_DOMAINS.split(',') 
        : [])
    ],
  },
}

module.exports = withPWA(nextConfig)

