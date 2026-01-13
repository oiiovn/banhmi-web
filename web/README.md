# Banhmi Web (Next.js)

Frontend web cho dự án Banhmi

## Cài đặt

1. Cài đặt dependencies:
```bash
npm install
# hoặc
yarn install
```

2. Tạo file `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

3. Chạy development server:
```bash
npm run dev
# hoặc
yarn dev
```

Ứng dụng sẽ chạy tại `http://localhost:3000`

## Cấu trúc dự án

- `app/` - Next.js App Router pages và layouts
- `components/` - React components
- `lib/` - Utility functions và API client
- `public/` - Static files

## Tính năng

- Xem danh sách sản phẩm
- Lọc sản phẩm theo danh mục
- Đăng ký/Đăng nhập
- Đặt hàng (sắp có)
