#!/bin/bash

echo "🚀 Bắt đầu build Next.js cho hosting..."
echo ""

cd "$(dirname "$0")"

# Kiểm tra .env.production
if [ ! -f .env.production ]; then
    echo "📝 Tạo file .env.production..."
    cat > .env.production << EOF
NEXT_PUBLIC_API_URL=https://api.websi.vn/api
NEXT_PUBLIC_IMAGE_DOMAINS=api.websi.vn,websi.vn
EOF
    echo "✅ Đã tạo .env.production"
fi

# Backup next.config.js
if [ ! -f next.config.js.backup ]; then
    cp next.config.js next.config.js.backup
    echo "✅ Đã backup next.config.js"
fi

# Sửa next.config.js để static export
echo "🔧 Đang cấu hình static export..."

# Kiểm tra xem đã có output: 'export' chưa
if ! grep -q "output: 'export'" next.config.js; then
    # Sửa next.config.js
    sed -i.bak "s/reactStrictMode: true,/reactStrictMode: true,\n  output: 'export',/" next.config.js
    
    # Sửa images unoptimized
    if grep -q "unoptimized:" next.config.js; then
        sed -i.bak "s/unoptimized:.*/unoptimized: true,/" next.config.js
    else
        sed -i.bak "s/images: {/images: {\n    unoptimized: true,/" next.config.js
    fi
    
    echo "✅ Đã cấu hình static export"
else
    echo "ℹ️  Static export đã được cấu hình"
fi

# Cài dependencies nếu chưa có
if [ ! -d "node_modules" ]; then
    echo "📦 Đang cài dependencies..."
    npm install
fi

# Build
echo "🏗️  Đang build Next.js..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build thành công!"
    echo ""
    echo "📁 File đã được tạo trong thư mục: web/out/"
    echo ""
    echo "📤 Các bước tiếp theo:"
    echo "   1. Upload toàn bộ nội dung trong thư mục 'out/' lên:"
    echo "      domains/websi.vn/public_html/"
    echo ""
    echo "   2. Tạo file .htaccess trong public_html/ với nội dung:"
    echo "      RewriteEngine On"
    echo "      RewriteBase /"
    echo "      RewriteRule ^index\.html$ - [L]"
    echo "      RewriteCond %{REQUEST_FILENAME} !-f"
    echo "      RewriteCond %{REQUEST_FILENAME} !-d"
    echo "      RewriteRule . /index.html [L]"
    echo ""
    echo "   3. Set permissions: chmod -R 755 public_html/"
    echo ""
else
    echo "❌ Build thất bại! Kiểm tra lỗi ở trên."
    exit 1
fi

