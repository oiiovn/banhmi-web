'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'
import { agentApi, Product, ProductData, Category, CategoryData } from '@/lib/api/agent'
import AgentHeader from '@/components/AgentHeader'
import Modal from '@/components/Modal'

export default function AgentProductsPage() {
  const router = useRouter()
  const { user, isAuthenticated, viewMode, setViewMode } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [formData, setFormData] = useState<ProductData>({
    sku: '',
    name: '',
    description: '',
    price: 0,
    wholesale_price: 0,
    original_price: 0,
    unit: '',
    quantity_per_unit: 0,
    image: '',
    category_id: 0,
    is_available: true,
  })

  const units = ['Cái', 'Kg', 'Lít', 'Thùng', 'Hộp', 'Gói', 'Lon', 'Chai', 'Túi', 'Bịch']
  const [errors, setErrors] = useState<Partial<ProductData>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryFormData, setCategoryFormData] = useState<CategoryData>({
    name: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [modal, setModal] = useState<{
    isOpen: boolean
    type: 'alert' | 'confirm'
    title?: string
    message: string
    onConfirm?: () => void
    confirmText?: string
    cancelText?: string
  }>({
    isOpen: false,
    type: 'alert',
    message: '',
  })

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return

    if (!isAuthenticated || !user || user.role !== 'agent') {
      router.push('/login')
      return
    }
    
    // Tự động chuyển sang agent mode khi vào trang agent
    if (viewMode !== 'agent') {
      setViewMode('agent')
    }
    
    fetchData()
  }, [isHydrated, isAuthenticated, user, router, selectedCategory, viewMode, setViewMode])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [productsRes, categoriesRes] = await Promise.all([
        agentApi.getProducts(selectedCategory || undefined),
        agentApi.getCategories(),
      ])

      if (productsRes.success) {
        setProducts(productsRes.data)
      }
      if (categoriesRes.success) {
        setCategories(categoriesRes.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Format số tiền: 1000000 -> 1.000.000
  const formatCurrency = (value: string | number): string => {
    if (!value && value !== 0) return ''
    // Convert to string and remove all non-digit characters
    const numbers = value.toString().replace(/\D/g, '')
    if (!numbers) return ''
    // Add dots as thousand separators
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  // Parse số tiền: "1.000.000" -> 1000000
  const parseCurrency = (value: string): number => {
    if (!value) return 0
    return parseFloat(value.replace(/\./g, '')) || 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    // Handle price fields with currency formatting
    const priceFields = ['wholesale_price', 'original_price', 'price']
    if (priceFields.includes(name)) {
      const numericValue = parseCurrency(value)
      
      setFormData((prev) => ({
        ...prev,
        [name]: numericValue,
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) || 0 : value,
      }))
    }
    
    if (errors[name as keyof ProductData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
    setErrorMessage('')
  }

  // Tự động cập nhật mô tả khi quantity_per_unit, unit, hoặc wholesale_price thay đổi
  useEffect(() => {
    if (formData.quantity_per_unit && formData.unit && formData.wholesale_price) {
      const quantity = formData.quantity_per_unit
      const unit = formData.unit
      const price = formData.wholesale_price
      // Format giá với dấu chấm phân cách hàng nghìn
      const formattedPrice = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      const newDescription = `Số lượng ${quantity} ${unit} là giá ${formattedPrice} đ`
      
      // Chỉ cập nhật nếu description khác với giá trị hiện tại để tránh vòng lặp vô hạn
      if (formData.description !== newDescription) {
        setFormData((prev) => ({
          ...prev,
          description: newDescription,
        }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.quantity_per_unit, formData.unit, formData.wholesale_price])

  const resetForm = () => {
    setFormData({
      sku: '', // SKU sẽ được backend tự động tạo
      name: '',
      description: '',
      price: 0,
      wholesale_price: 0,
      original_price: 0,
      unit: '',
      quantity_per_unit: 0,
      image: '',
      category_id: 0,
      is_available: true,
    })
    setErrors({})
    setEditingProduct(null)
    setShowCreateForm(false)
    setImageFile(null)
    setImagePreview(null)
    setFileInputKey(prev => prev + 1) // Reset file input
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      sku: product.sku || '',
      name: product.name,
      description: product.description || '',
      price: product.price ? parseFloat(product.price) : 0,
      wholesale_price: product.wholesale_price ? parseFloat(product.wholesale_price) : 0,
      original_price: product.original_price ? parseFloat(product.original_price) : 0,
      unit: product.unit || '',
      quantity_per_unit: product.quantity_per_unit ? parseFloat(product.quantity_per_unit) : 0,
      image: product.image || '',
      category_id: product.category_id,
      is_available: product.is_available,
    })
    setImageFile(null)
    setImagePreview(product.image || null)
    setFileInputKey(prev => prev + 1) // Reset file input
    setShowCreateForm(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    // Validate all required fields
    // SKU không cần validate vì backend tự động tạo khi tạo mới
    // Chỉ validate SKU khi đang edit (nhưng SKU không được phép sửa)
    
    if (!formData.name.trim()) {
      setErrorMessage('Tên sản phẩm là bắt buộc')
      return
    }

    if (!formData.category_id) {
      setErrorMessage('Vui lòng chọn danh mục')
      return
    }

    if (!formData.wholesale_price || formData.wholesale_price <= 0) {
      setErrorMessage('Giá sỉ là bắt buộc và phải lớn hơn 0')
      return
    }

    if (!formData.original_price || formData.original_price <= 0) {
      setErrorMessage('Giá gốc là bắt buộc và phải lớn hơn 0')
      return
    }

    if (!formData.unit?.trim()) {
      setErrorMessage('Vui lòng chọn đơn vị')
      return
    }

    if (!formData.description?.trim()) {
      setErrorMessage('Mô tả là bắt buộc')
      return
    }

    // Image is required only when creating new product
    if (!editingProduct && !imageFile) {
      setErrorMessage('Vui lòng chọn ảnh sản phẩm')
      return
    }

    setIsSubmitting(true)

    try {
      // Always use FormData if imageFile exists, otherwise use JSON
      // Same logic for both create and update
      let submitData: FormData | ProductData
      
      console.log('=== SUBMIT PRODUCT ===')
      console.log('Editing product:', editingProduct?.id)
      console.log('Has imageFile:', !!imageFile)
      console.log('ImageFile:', imageFile ? { name: imageFile.name, size: imageFile.size, type: imageFile.type } : null)
      
      if (imageFile) {
        // Use FormData when there's an image file (same as create)
        submitData = new FormData()
        // Không gửi SKU khi tạo mới (backend tự động tạo)
        // Chỉ gửi SKU khi đang edit (nhưng backend sẽ bỏ qua vì không cho phép sửa)
        if (editingProduct && formData.sku) {
          submitData.append('sku', formData.sku)
        }
        submitData.append('name', formData.name)
        submitData.append('description', formData.description || '')
        submitData.append('price', formData.price.toString())
        submitData.append('wholesale_price', (formData.wholesale_price || 0).toString())
        submitData.append('original_price', (formData.original_price || 0).toString())
        submitData.append('unit', formData.unit || '')
        submitData.append('quantity_per_unit', (formData.quantity_per_unit || 0).toString())
        submitData.append('category_id', formData.category_id.toString())
        submitData.append('is_available', formData.is_available ? '1' : '0')
        submitData.append('image', imageFile)
        
        console.log('FormData created')
        console.log('FormData entries:')
        submitData.forEach((value, key) => {
          if (value instanceof File) {
            console.log(`  ${key}: File(${value.name}, ${value.size} bytes)`)
          } else {
            console.log(`  ${key}: ${value}`)
          }
        })
      } else {
        // Use JSON when no image file
        // Remove image field to keep existing image
        const { image, sku, ...dataWithoutImage } = formData
        // Không gửi SKU khi tạo mới (backend tự động tạo)
        // Chỉ gửi SKU khi đang edit (nhưng backend sẽ bỏ qua vì không cho phép sửa)
        if (editingProduct && sku) {
          submitData = { ...dataWithoutImage, sku }
        } else {
          submitData = dataWithoutImage
        }
        console.log('Using JSON data (no image file - keeping existing image)')
      }

      if (editingProduct) {
        console.log('Calling updateProduct API...')
        const response = await agentApi.updateProduct(editingProduct.id, submitData)
        console.log('Update response:', response)
        if (response.success) {
          console.log('✅ Update successful!')
          resetForm()
          fetchData()
        } else {
          console.error('❌ Update failed:', response.message)
          setErrorMessage(response.message || 'Không thể cập nhật sản phẩm')
        }
      } else {
        console.log('Calling createProduct API...')
        const response = await agentApi.createProduct(submitData)
        console.log('Create response:', response)
        if (response.success) {
          console.log('✅ Create successful!')
          resetForm()
          fetchData()
        } else {
          console.error('❌ Create failed:', response.message)
          setErrorMessage(response.message || 'Không thể tạo sản phẩm')
        }
      }
    } catch (error: any) {
      console.error('❌ Error saving product:', error)
      console.error('Error response:', error.response?.data)
      console.error('Error status:', error.response?.status)
      if (error.response?.data?.errors) {
        const apiErrors = error.response.data.errors
        const newErrors: Partial<ProductData> = {}
        Object.keys(apiErrors).forEach((key) => {
          if (key in formData) {
            newErrors[key as keyof ProductData] = Array.isArray(apiErrors[key])
              ? apiErrors[key][0]
              : apiErrors[key]
          }
        })
        setErrors(newErrors)
        setErrorMessage('Vui lòng kiểm tra lại thông tin đã nhập: ' + JSON.stringify(apiErrors))
      } else {
        setErrorMessage(error.response?.data?.message || error.message || 'Không thể lưu sản phẩm')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    setModal({
      isOpen: true,
      type: 'confirm',
      title: 'Xác nhận xóa',
      message: 'Bạn có chắc chắn muốn xóa sản phẩm này?',
      onConfirm: async () => {
        try {
          const response = await agentApi.deleteProduct(id)
          if (response.success) {
            setModal({
              isOpen: true,
              type: 'alert',
              title: 'Thành công',
              message: 'Đã xóa sản phẩm thành công!',
            })
            fetchData()
          }
        } catch (error: any) {
          setModal({
            isOpen: true,
            type: 'alert',
            title: 'Lỗi',
            message: 'Không thể xóa sản phẩm: ' + (error.response?.data?.message || error.message),
          })
        }
      },
    })
  }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setCategoryFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!categoryFormData.name.trim()) {
      setErrorMessage('Tên danh mục là bắt buộc')
      return
    }

    setIsSubmitting(true)

    try {
      if (editingCategory) {
        const response = await agentApi.updateCategory(editingCategory.id, categoryFormData)
        if (response.success) {
          setShowCategoryForm(false)
          setEditingCategory(null)
          setCategoryFormData({ name: '' })
          fetchData()
        }
      } else {
        const response = await agentApi.createCategory(categoryFormData)
        if (response.success) {
          setShowCategoryForm(false)
          setCategoryFormData({ name: '', description: '', image: '' })
          fetchData()
        }
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || 'Không thể lưu danh mục')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCategory = async (id: number) => {
    setModal({
      isOpen: true,
      type: 'confirm',
      title: 'Xác nhận xóa',
      message: 'Bạn có chắc chắn muốn xóa danh mục này? Sản phẩm trong danh mục này sẽ không bị xóa.',
      onConfirm: async () => {
        try {
          const response = await agentApi.deleteCategory(id)
          if (response.success) {
            setModal({
              isOpen: true,
              type: 'alert',
              title: 'Thành công',
              message: 'Đã xóa danh mục thành công!',
            })
            fetchData()
          } else {
            setModal({
              isOpen: true,
              type: 'alert',
              title: 'Lỗi',
              message: response.message || 'Không thể xóa danh mục',
            })
          }
        } catch (error: any) {
          setModal({
            isOpen: true,
            type: 'alert',
            title: 'Lỗi',
            message: 'Không thể xóa danh mục: ' + (error.response?.data?.message || error.message),
          })
        }
      },
    })
  }

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user || user.role !== 'agent') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AgentHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Quản lý Sản phẩm</h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCategoryFormData({ name: '' })
                setEditingCategory(null)
                setShowCategoryForm(true)
              }}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
            >
              + Tạo danh mục
            </button>
            <button
              onClick={() => {
                resetForm()
                setShowCreateForm(true)
              }}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
            >
              + Tạo sản phẩm mới
            </button>
          </div>
        </div>

        {/* Category Filter */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                selectedCategory === null
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tất cả
            </button>
            {categories.map((category) => (
              <div key={category.id} className="relative group">
                <button
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    selectedCategory === category.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.name}
                </button>
                <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingCategory(category)
                      setCategoryFormData({
                        name: category.name,
                      })
                      setShowCategoryForm(true)
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 mr-1"
                    title="Sửa"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteCategory(category.id)
                    }}
                    className="text-xs text-red-600 hover:text-red-800"
                    title="Xóa"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {errorMessage}
          </div>
        )}

        {/* Category Create/Edit Form */}
        {showCategoryForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-xl font-bold mb-4">
              {editingCategory ? 'Chỉnh sửa danh mục' : 'Tạo danh mục mới'}
            </h3>
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên danh mục *
                </label>
                <input
                  type="text"
                  name="name"
                  value={categoryFormData.name}
                  onChange={handleCategoryChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Nhập tên danh mục"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryForm(false)
                    setEditingCategory(null)
                    setCategoryFormData({ name: '' })
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : editingCategory ? 'Cập nhật' : 'Tạo danh mục'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-xl font-bold mb-4">
              {editingProduct ? 'Chỉnh sửa sản phẩm' : 'Tạo sản phẩm mới'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mã sản phẩm (SKU) {editingProduct ? '(Tự động - Không thể sửa)' : '(Tự động tạo)'}
                  </label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku || (editingProduct && editingProduct.sku ? editingProduct.sku : '')}
                    onChange={handleChange}
                    disabled
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                    placeholder={editingProduct ? (editingProduct.sku || 'SKU') : 'Sẽ được tạo tự động (SP0001, SP0002, ...)'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên sản phẩm *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Danh mục *
                  </label>
                  <select
                    name="category_id"
                    value={formData.category_id}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value={0}>Chọn danh mục</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>


                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Giá sỉ (đ) *
                  </label>
                  <input
                    type="text"
                    name="wholesale_price"
                    value={formData.wholesale_price ? formatCurrency(formData.wholesale_price.toString()) : ''}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Giá gốc (đ) *
                  </label>
                  <input
                    type="text"
                    name="original_price"
                    value={formData.original_price ? formatCurrency(formData.original_price.toString()) : ''}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Đơn vị *
                  </label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Chọn đơn vị</option>
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số lượng trên đơn vị
                  </label>
                  <input
                    type="number"
                    name="quantity_per_unit"
                    value={formData.quantity_per_unit || ''}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="VD: 20 (nếu 1 Thùng = 20 Cái)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ví dụ: 1 Thùng = 20 Cái, nhập 20
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ảnh sản phẩm *
                  </label>
                  <input
                    key={fileInputKey}
                    type="file"
                    name="image"
                    accept="image/*"
                    onChange={handleImageChange}
                    required={!editingProduct}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  {imagePreview && (
                    <div className="mt-2">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-32 h-32 aspect-square object-cover rounded-lg border border-gray-300"
                      />
                      {imageFile && (
                        <p className="text-sm text-gray-500 mt-1">
                          Ảnh mới: {imageFile.name} ({(imageFile.size / 1024).toFixed(2)} KB)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_available"
                    checked={formData.is_available}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">
                    Sản phẩm đang bán
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô tả *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : editingProduct ? 'Cập nhật' : 'Tạo sản phẩm'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Products List */}
        {loading ? (
          <div className="text-center py-8">Đang tải...</div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">Chưa có sản phẩm nào</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ảnh
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mã SP
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tên sản phẩm
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Danh mục
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Giá sỉ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Giá gốc
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Đơn vị
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-16 h-16 aspect-square object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-16 h-16 aspect-square bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                          No Image
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.sku || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.category?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.wholesale_price ? (
                        <div>
                          <div>{parseFloat(product.wholesale_price).toLocaleString('vi-VN')} đ</div>
                          {product.unit && (
                            <div className="text-xs text-gray-400">
                              {product.quantity_per_unit && parseFloat(product.quantity_per_unit) > 0
                                ? `${parseFloat(product.quantity_per_unit)} ${product.unit}`
                                : product.unit}
                            </div>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.original_price ? (
                        <div>
                          <div>{parseFloat(product.original_price).toLocaleString('vi-VN')} đ</div>
                          {product.unit && (
                            <div className="text-xs text-gray-400">
                              {product.quantity_per_unit && parseFloat(product.quantity_per_unit) > 0
                                ? `${parseFloat(product.quantity_per_unit)} ${product.unit}`
                                : product.unit}
                            </div>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.unit ? (
                        <div>
                          <div>
                            {product.quantity_per_unit && parseFloat(product.quantity_per_unit) > 0
                              ? `${parseFloat(product.quantity_per_unit)} ${product.unit}`
                              : product.unit}
                          </div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          product.is_available
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {product.is_available ? 'Đang bán' : 'Ngừng bán'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-primary-600 hover:text-primary-900 mr-4"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
      />
    </div>
  )
}

