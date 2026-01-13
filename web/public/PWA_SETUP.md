# PWA Setup Guide

## Icons cần thiết

Để PWA hoạt động đầy đủ, bạn cần tạo 2 file icon PNG:

1. `icon-192x192.png` - 192x192 pixels
2. `icon-512x512.png` - 512x512 pixels

## Cách tạo icons

### Option 1: Sử dụng online tools (Khuyến nghị)
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator
- Upload logo hoặc tạo icon với emoji 🍞 trên nền màu #f97316

### Option 2: Tạo thủ công
- Sử dụng Photoshop, Figma, hoặc bất kỳ tool design nào
- Tạo icon 512x512 với emoji 🍞 hoặc logo
- Export thành PNG
- Resize thành 192x192 cho icon nhỏ

### Option 3: Sử dụng SVG hiện có
File SVG đã được tạo sẵn tại:
- `/public/icon-192x192.svg`
- `/public/icon-512x512.svg`

Bạn có thể convert SVG sang PNG bằng:
- Online: https://cloudconvert.com/svg-to-png
- Hoặc sử dụng ImageMagick: `convert icon-192x192.svg icon-192x192.png`

## Sau khi tạo icons

1. Đặt file PNG vào thư mục `/public`
2. Đảm bảo tên file đúng: `icon-192x192.png` và `icon-512x512.png`
3. Rebuild app: `npm run build`
4. Test PWA trên mobile browser

## Test PWA

1. Build app: `npm run build && npm start`
2. Mở trên mobile browser (Chrome/Safari)
3. Kiểm tra "Add to Home Screen" option
4. Test offline functionality




