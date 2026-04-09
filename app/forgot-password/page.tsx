'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const redirectTo = `${window.location.origin}/reset-password`

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    if (error) {
      setError('Không thể gửi email. Vui lòng kiểm tra lại địa chỉ email.')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔑</span>
          </div>
          <h1 className="text-lg font-bold text-gray-800">Quên mật khẩu</h1>
          <p className="text-sm text-gray-500 mt-1">Forgot your password?</p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4">
              <p className="text-sm font-semibold text-green-700">Email đã được gửi!</p>
              <p className="text-xs text-green-600 mt-1">
                Kiểm tra hộp thư <strong>{email}</strong> và click vào link để đặt lại mật khẩu.
              </p>
              <p className="text-xs text-green-500 mt-2">
                Check your inbox and click the reset link.
              </p>
            </div>
            <p className="text-xs text-gray-400">
              Không thấy email? Kiểm tra thư mục Spam.
              <br />
              <span className="text-gray-300">Not seeing it? Check your spam folder.</span>
            </p>
            <a href="/login" className="block text-sm text-blue-600 hover:underline mt-2">
              ← Quay lại đăng nhập / Back to login
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-500 text-center -mt-2 mb-4">
              Nhập email của bạn, chúng tôi sẽ gửi link đặt lại mật khẩu.
              <br />
              <span className="text-xs text-gray-400">Enter your email and we'll send you a reset link.</span>
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {loading ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
            </button>

            <a href="/login" className="block text-center text-sm text-gray-400 hover:text-gray-600 mt-2">
              ← Quay lại đăng nhập
            </a>
          </form>
        )}
      </div>
    </div>
  )
}
