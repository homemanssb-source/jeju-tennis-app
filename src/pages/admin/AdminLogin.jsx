import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function AdminLogin() {
  const showToast = useContext(ToastContext)
  const navigate = useNavigate()

  // 로그인 상태
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // 비밀번호 변경 모드
  const [mode, setMode] = useState('login') // 'login' | 'change'
  const [loggedInUser, setLoggedInUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changing, setChanging] = useState(false)

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
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', email.trim())
        .single()

      if (!adminUser) {
        await supabase.auth.signOut()
        showToast?.('관리자 계정이 아닙니다.', 'error')
      } else {
        setLoggedInUser(adminUser)
        showToast?.(`${adminUser.name}님 환영합니다!`)
        navigate('/admin/members')
      }
    }
    setLoading(false)
  }

  async function handleChangePassword(e) {
    e.preventDefault()

    if (newPassword.length < 6) {
      showToast?.('비밀번호는 6자 이상이어야 합니다.', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast?.('새 비밀번호가 일치하지 않습니다.', 'error')
      return
    }

    setChanging(true)

    // 먼저 현재 비밀번호로 로그인 확인
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (loginError) {
      showToast?.('현재 비밀번호가 올바르지 않습니다.', 'error')
      setChanging(false)
      return
    }

    // 비밀번호 변경
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      showToast?.('비밀번호 변경 실패: ' + updateError.message, 'error')
    } else {
      showToast?.('비밀번호가 변경되었습니다. 다시 로그인해주세요.')
      await supabase.auth.signOut()
      setMode('login')
      setNewPassword('')
      setConfirmPassword('')
      setPassword('')
    }
    setChanging(false)
  }

  // ── 비밀번호 변경 화면 ──
  if (mode === 'change') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-xs shadow-sm border border-line">
          <h1 className="text-xl font-bold text-center mb-1">🔑 비밀번호 변경</h1>
          <p className="text-sm text-sub text-center mb-6">새 비밀번호를 설정해주세요</p>

          <form onSubmit={handleChangePassword} className="space-y-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">현재 비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="현재 비밀번호"
                autoComplete="current-password"
                className="w-full text-sm border border-line rounded-xl px-4 py-3
                  focus:border-accent focus:ring-2 focus:ring-accentSoft"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 (6자 이상)"
                autoComplete="new-password"
                className="w-full text-sm border border-line rounded-xl px-4 py-3
                  focus:border-accent focus:ring-2 focus:ring-accentSoft"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호 확인</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="새 비밀번호 재입력"
                autoComplete="new-password"
                className="w-full text-sm border border-line rounded-xl px-4 py-3
                  focus:border-accent focus:ring-2 focus:ring-accentSoft"
              />
            </div>

            <button
              type="submit"
              disabled={changing}
              className="w-full bg-accent text-white py-3 rounded-xl font-semibold
                hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {changing ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>

          <button
            onClick={() => setMode('login')}
            className="w-full mt-3 text-sm text-sub hover:text-gray-700 py-2"
          >
            ← 로그인으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  // ── 로그인 화면 ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-soft p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-xs shadow-sm border border-line">
        <h1 className="text-xl font-bold text-center mb-1">🎾 관리자</h1>
        <p className="text-sm text-sub text-center mb-6">제주도 테니스 협회</p>

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

        {/* 비밀번호 변경 버튼 */}
        <button
          onClick={() => setMode('change')}
          className="w-full mt-2 text-sm text-accent hover:text-blue-700 py-2 font-medium transition-colors"
        >
          🔑 비밀번호 변경
        </button>

        <button
          onClick={() => navigate('/')}
          className="w-full mt-1 text-sm text-sub hover:text-gray-700 py-2"
        >
          ← 공개 페이지로
        </button>
      </div>
    </div>
  )
}