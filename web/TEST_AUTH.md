# 🧪 Hướng dẫn test Đăng ký & Đăng nhập

## ✅ Trạng thái

Các trang đã được khởi động lại và hoạt động bình thường:
- ✅ Trang đăng nhập: http://localhost:3002/login
- ✅ Trang đăng ký: http://localhost:3002/register

## 🧪 Test Đăng nhập

1. Truy cập: http://localhost:3002/login

2. Test với tài khoản Admin:
   - Email: `admin@banhmi.com`
   - Password: `admin123`
   - Sau khi đăng nhập sẽ redirect đến `/` hoặc `/admin`

3. Test với tài khoản Đại lý:
   - Email: `agent1@banhmi.com`
   - Password: `agent123`
   - Sau khi đăng nhập sẽ redirect đến `/` hoặc `/agent`

4. Test validation:
   - Thử submit form trống → Hiển thị lỗi
   - Thử email không hợp lệ → Hiển thị lỗi
   - Thử password < 8 ký tự → Hiển thị lỗi

## 🧪 Test Đăng ký

1. Truy cập: http://localhost:3002/register

2. Điền form đăng ký:
   - Họ và tên: (bắt buộc, tối thiểu 2 ký tự)
   - Email: (bắt buộc, phải hợp lệ)
   - Số điện thoại: (tùy chọn)
   - Địa chỉ: (tùy chọn)
   - Mật khẩu: (bắt buộc, tối thiểu 8 ký tự)
   - Xác nhận mật khẩu: (phải khớp với mật khẩu)

3. Test validation:
   - Thử submit form trống → Hiển thị lỗi
   - Thử email đã tồn tại → Hiển thị lỗi từ API
   - Thử password không khớp → Hiển thị lỗi

4. Sau khi đăng ký thành công:
   - Tự động đăng nhập
   - Redirect về trang chủ `/`
   - Header hiển thị thông tin user

## 🔍 Kiểm tra sau khi đăng nhập

1. **Header Navigation:**
   - Hiển thị tên user
   - Hiển thị role (Admin/Đại lý/Khách hàng)
   - Có link "Đơn hàng"
   - Có nút "Đăng xuất"

2. **Trang chủ:**
   - Vẫn hiển thị sản phẩm bình thường
   - Navigation đã thay đổi theo trạng thái đăng nhập

3. **Trang Đơn hàng:**
   - Truy cập: http://localhost:3002/orders
   - Hiển thị danh sách đơn hàng của user
   - Nếu chưa đăng nhập sẽ redirect về `/login`

## 🐛 Troubleshooting

### Nếu trang không load:
1. Kiểm tra server đang chạy: `lsof -ti:3002`
2. Xóa cache và restart:
   ```bash
   cd web
   rm -rf .next
   npm run dev -- -p 3002
   ```

### Nếu đăng nhập không hoạt động:
1. Kiểm tra API đang chạy: http://localhost:8000/api/categories
2. Kiểm tra console browser (F12) để xem lỗi
3. Kiểm tra Network tab để xem request/response

### Nếu gặp lỗi CORS:
- Kiểm tra `api/config/cors.php` đã cấu hình đúng chưa
- Đảm bảo `allowed_origins` có `http://localhost:3002`

## 📝 Tài khoản test

- **Admin**: `admin@banhmi.com` / `admin123`
- **Đại lý 1**: `agent1@banhmi.com` / `agent123`
- **Đại lý 2**: `agent2@banhmi.com` / `agent123`

## ✨ Tính năng đã hoàn thành

- ✅ Form validation (client-side)
- ✅ Hiển thị lỗi từ API
- ✅ Auto-login sau khi đăng ký
- ✅ Redirect theo role sau khi đăng nhập
- ✅ Protected routes (trang đơn hàng)
- ✅ Logout functionality
- ✅ Persistent authentication (lưu vào localStorage)
- ✅ Auto logout khi token hết hạn (401)




