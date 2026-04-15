'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Step = 'loading' | 'form' | 'success' | 'error'

function ResetPasswordContent() {
  const [step,     setStep]     = useState<Step>('loading')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [showPass, setShowPass] = useState(false)
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  useEffect(() => {
    const handleToken = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))

      // Case 0: Supabase redirected with error params — check BEFORE trying any token
      const urlError     = searchParams.get('error')
      const urlErrorCode = searchParams.get('error_code')
      const hashError    = hashParams.get('error') || hashParams.get('error_code')
      if (urlError || hashError) {
        const code = urlErrorCode || urlError || hashError || ''
        if (code.includes('expired') || code.includes('otp')) {
          setError('Link đã hết hạn. Vui lòng yêu cầu link mới.\nThis link has expired. Please request a new one.')
        } else if (code.includes('access_denied')) {
          setError('Yêu cầu bị từ chối. Vui lòng thử lại.\nAccess denied. Please try again.')
        } else {
          setError(`Lỗi xác thực: ${code}`)
        }
        setStep('error')
        return
      }

      // Case 1: token_hash flow (recommended — immune to email pre-fetch)
      // Recovery email: ?token_hash=...&type=recovery
      // Invite email:   ?token_hash=...&type=invite
      const tokenHash = searchParams.get('token_hash')
      const typeParam = searchParams.get('type') as 'recovery' | 'invite' | null
      if (tokenHash && (typeParam === 'recovery' || typeParam === 'invite')) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: typeParam,
        })
        setStep(error ? 'error' : 'form')
        return
      }

      // Case 2: PKCE flow — ?code=CODE
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        setStep(error ? 'error' : 'form')
        return
      }

      // Case 3: Implicit flow — #access_token=TOKEN&type=recovery
      const accessToken  = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token') ?? ''
      const type         = hashParams.get('type')
      if (type === 'recovery' && accessToken) {
        const { error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        })
        setStep(error ? 'error' : 'form')
        return
      }

      // No valid token found
      setStep('error')
    }

    handleToken()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự. / Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Mật khẩu không khớp. / Passwords do not match.')
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('Không thể cập nhật mật khẩu. Vui lòng thử lại. / Could not update password.')
      setSaving(false)
      return
    }
    await supabase.auth.signOut({ scope: 'global' })
    setStep('success')
    setSaving(false)
  }

  if (step === 'loading') return (
    <div className="bg-white rounded-2xl shadow-lg p-8 text-center w-72">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm text-gray-500">Đang xác thực... / Verifying...</p>
    </div>
  )

  if (step === 'error') return (
    <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8 text-center space-y-4">
      <span className="text-4xl">⚠️</span>
      <h1 className="text-lg font-bold text-gray-800">Link không hợp lệ</h1>
      {error ? (
        <p className="text-sm text-gray-500 whitespace-pre-line">{error}</p>
      ) : (
        <>
          <p className="text-sm text-gray-500">Link đã hết hạn hoặc đã được sử dụng.</p>
          <p className="text-xs text-gray-400">This link has expired or already been used.</p>
        </>
      )}
      <a href="/forgot-password" className="block w-full bg-blue-600 text-white font-medium py-3 rounded-xl text-sm mt-2">
        Yêu cầu link mới / Request new link
      </a>
    </div>
  )

  if (step === 'success') return (
    <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8 text-center space-y-4">
      <span className="text-4xl">✅</span>
      <h1 className="text-lg font-bold text-gray-800">Đặt lại mật khẩu thành công!</h1>
      <p className="text-sm text-gray-500">Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.</p>
      <p className="text-xs text-gray-400">Your password has been updated. Please sign in again.</p>
      <button onClick={() => router.push('/login')} className="w-full bg-blue-600 text-white font-medium py-3 rounded-xl text-sm">
        Đăng nhập / Sign in
      </button>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">
      <div className="text-center mb-7">
        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔐</span>
        </div>
        <h1 className="text-lg font-bold text-gray-800">Đặt lại mật khẩu</h1>
        <p className="text-sm text-gray-400 mt-1">Set new password</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mật khẩu mới / New password
          </label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              required
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="button" onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm px-1">
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Xác nhận mật khẩu / Confirm password
          </label>
          <input
            type={showPass ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Nhập lại mật khẩu"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {password.length > 0 && (
          <div className="flex gap-1">
            {[1,2,3,4].map(i => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${
                password.length >= i * 3
                  ? i <= 1 ? 'bg-red-400' : i <= 2 ? 'bg-amber-400' : i <= 3 ? 'bg-blue-400' : 'bg-green-400'
                  : 'bg-gray-200'
              }`} />
            ))}
          </div>
        )}

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

        <button type="submit" disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl transition-colors">
          {saving ? 'Đang lưu...' : 'Cập nhật mật khẩu / Update password'}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center px-4">
      <Suspense fallback={
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center w-72">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      }>
        <ResetPasswordContent />
      </Suspense>
    </div>
  )
}
