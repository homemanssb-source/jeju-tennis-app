import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function AdminLogin() {
  const showToast = useContext(ToastContext)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    if (!email.trim() || !password) {
      showToast?.('이메일과 비밀번호를 입력해주세요.', 'error')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      showToast?.('로그인 실패: 이메일 또는 비밀번호가 올바르지 않습니다.', 'error')
    } else {
      // admin_users 테이블에 등록된 관리자인지 확인
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', email.trim())
        .single()

      if (!adminUser) {
        // 관리자 테이블에 없으면 로그아웃
        await supabase.auth.signOut()
        showToast?.('관리자 계정이 아닙니다.', 'error')
      } else {
        showToast?.(`${adminUser.name}님 환영합니다!`)
        navigate('/admin/members')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-xs shadow-sm border border-line">
        <h1 className="text-xl font-bold text-center mb-1">🎾 관리자</h1>
        <p className="text-sm text-sub text-center mb-6">제주도 테니스 협호회</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="관리자 이메일"
              autoComplete="email"
              className="w-full text-sm border border-line rounded-xl px-4 py-3
                focus:border-accent focus:ring-2 focus:ring-accentSoft"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호"
              autoComplete="current-password"
              className="w-full text-sm border border-line rounded-xl px-4 py-3
                focus:border-accent focus:ring-2 focus:ring-accentSoft"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white py-3 rounded-xl font-semibold
              hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <button
          onClick={() => navigate('/')}
          className="w-full mt-3 text-sm text-sub hover:text-gray-700 py-2"
        >
          ← 공개 페이지로
        </button>
      </div>
    </div>
  )
}