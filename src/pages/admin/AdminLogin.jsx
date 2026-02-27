import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function AdminLogin() {
  const showToast = useContext(ToastContext)
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const adminPin = import.meta.env.VITE_ADMIN_PIN
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD

  async function handleLogin(e) {
    e.preventDefault()
    if (pin !== adminPin) {
      showToast?.('PIN 번호가 올바르지 않습니다.', 'error')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    })

    if (error) {
      showToast?.('관리자 로그인 실패: ' + error.message, 'error')
    } else {
      showToast?.('관리자 모드 진입')
      navigate('/admin/members')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft p-4">
      <div className="bg-white rounded-r2 p-8 w-full max-w-xs shadow-sm border border-line">
        <h1 className="text-xl font-bold text-center mb-1">🎾 관리자</h1>
        <p className="text-sm text-sub text-center mb-6">제주시 테니스 동호인회</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">관리자 PIN</label>
            <input type="password" value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="PIN 입력"
              maxLength={10}
              className="w-full text-center text-lg tracking-widest border border-line rounded-xl
                px-4 py-3 focus:border-accent focus:ring-2 focus:ring-accentSoft" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-accent text-white py-3 rounded-xl font-semibold
              hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <button onClick={() => navigate('/')}
          className="w-full mt-3 text-sm text-sub hover:text-gray-700 py-2">
          ← 공개 페이지로
        </button>
      </div>
    </div>
  )
}
