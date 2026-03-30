import { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { ToastContext } from '../App'

const DIVISIONS = ['지도자부','마스터부','베테랑부','신인부','여자마스터부','여자베테랑부','여자신인부']

export default function RegisterPage() {
  const showToast = useContext(ToastContext)
  const [grades, setGrades] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [phoneChecking, setPhoneChecking] = useState(false)  // ✅ 전화번호 체크 중 상태
  const [phoneDupError, setPhoneDupError] = useState('')     // ✅ 전화번호 중복 에러 메시지
  const [form, setForm] = useState({
    name: '', gender: '', phone: '', club: '', division: '', grade: '',
  })

  useEffect(() => { fetchGrades() }, [])

  async function fetchGrades() {
    const { data } = await supabase.rpc('get_grade_options')
    if (data) setGrades(data.map(d => d.grade_value))
  }

  function handleChange(key, value) {
    setForm({ ...form, [key]: value })
    // 전화번호 변경 시 에러 초기화
    if (key === 'phone') setPhoneDupError('')
  }

  // ✅ 전화번호 포커스 아웃 시 중복 체크
  async function handlePhoneBlur() {
    const phoneNorm = form.phone.replace(/[^0-9]/g, '')
    if (phoneNorm.length < 10) return // 너무 짧으면 체크 안 함

    setPhoneChecking(true)
    const { data } = await supabase
      .from('members')
      .select('member_id, name, status')
      .eq('phone', phoneNorm)
      .neq('status', '삭제')
      .limit(1)
    setPhoneChecking(false)

    if (data && data.length > 0) {
      const m = data[0]
      const statusLabel =
        m.status === '활성' ? '활성 회원' :
        m.status === '휴면' ? '가입 대기 중' : m.status
      setPhoneDupError(`이미 등록된 전화번호입니다. (${m.name} · ${statusLabel})`)
    } else {
      setPhoneDupError('') // 중복 없음
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.gender || !form.phone || !form.club || !form.division || !form.grade) {
      showToast?.('이름, 성별, 전화번호, 소속클럽, 랭킹부서, 등급은 필수입니다.', 'error')
      return
    }
    if (!agreed) {
      showToast?.('약관에 동의해주세요.', 'error')
      return
    }
    // ✅ 중복 에러 있으면 제출 차단
    if (phoneDupError) {
      showToast?.('전화번호를 확인해주세요.', 'error')
      return
    }

    setSubmitting(true)

    // ✅ 제출 직전 최종 전화번호 중복 체크 (이중 방어)
    const phoneNorm = form.phone.replace(/[^0-9]/g, '')
    const { data: existing } = await supabase
      .from('members')
      .select('member_id, name, status')
      .eq('phone', phoneNorm)
      .neq('status', '삭제')
      .limit(1)

    if (existing && existing.length > 0) {
      const m = existing[0]
      const statusLabel =
        m.status === '활성' ? '활성 회원' :
        m.status === '휴면' ? '가입 대기 중' : m.status
      setPhoneDupError(`이미 등록된 전화번호입니다. (${m.name} · ${statusLabel})`)
      showToast?.('이미 등록된 전화번호입니다.', 'error')
      setSubmitting(false)
      return
    }

    const memberId = 'M' + Date.now().toString().slice(-8)
    const nameNorm = form.name.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase()

    const { error } = await supabase.from('members').insert([{
      member_id: memberId,
      name: form.name,
      display_name: form.name,
      name_norm: nameNorm,
      gender: form.gender,
      phone: phoneNorm,
      club: form.club,
      division: form.division,
      grade: form.grade,
      status: '휴면',
      grade_source: 'auto',
      registered_at: new Date().toISOString(),
    }])

    if (error) {
      // ✅ DB UNIQUE 제약으로 막혔을 때도 친절한 메시지
      if (error.code === '23505') {
        showToast?.('이미 등록된 전화번호입니다.', 'error')
        setPhoneDupError('이미 등록된 전화번호입니다.')
      } else {
        showToast?.('가입 실패: ' + error.message, 'error')
      }
    } else {
      setSubmitted(true)
      showToast?.('회원 등록 신청이 완료되었습니다!')
    }
    setSubmitting(false)
  }

  function resetForm() {
    setSubmitted(false)
    setForm({ name: '', gender: '', phone: '', club: '', division: '', grade: '' })
    setAgreed(false)
    setPhoneDupError('')
  }

  if (submitted) {
    return (
      <div className="pb-20">
        <PageHeader title="👤 회원가입" />
        <div className="max-w-lg mx-auto px-5 py-12 text-center">
          <p className="text-5xl mb-4">🎉</p>
          <h2 className="text-lg font-bold text-gray-900 mb-2">등록 신청 완료!</h2>
          <p className="text-sm text-sub mb-4">등록비 납부 후 회원 활성화됩니다.</p>
          <div className="bg-soft rounded-lg p-4 text-left">
            <p className="text-sm font-semibold mb-2">💰 등록비 안내</p>
            <p className="text-sm text-gray-700">제주은행 계좌로 등록비를 입금해주세요.</p>
            <p className="text-sm text-gray-700 mt-1">입금자명은 <b>본인 이름</b>으로 해주세요.</p>
            <p className="text-xs text-sub mt-2">입금 확인 후 관리자가 활성화합니다.</p>
          </div>
          <button onClick={resetForm} className="mt-6 text-sm text-accent hover:underline">
            다른 회원 등록하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <PageHeader title="👤 회원가입" subtitle="동호인회 회원 등록 신청" />

      <div className="max-w-lg mx-auto px-5 py-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-amber-700">
            ⚠️ 등록 후 <b>등록비 납부</b>가 확인되면 관리자가 활성화합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="실명 입력"
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5
                focus:border-accent focus:ring-2 focus:ring-accentSoft" />
          </div>

          {/* 성별 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              성별 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              {['남', '여'].map(g => (
                <button key={g} type="button"
                  onClick={() => handleChange('gender', g)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors
                    ${form.gender === g
                      ? 'bg-accent text-white border-accent'
                      : 'bg-white text-sub border-line hover:bg-soft'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 전화번호 ✅ onBlur 중복체크 추가 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input type="tel" value={form.phone}
                onChange={e => handleChange('phone', e.target.value)}
                onBlur={handlePhoneBlur}
                placeholder="010-0000-0000"
                className={`w-full text-sm border rounded-lg px-3 py-2.5
                  focus:ring-2 focus:ring-accentSoft transition-colors
                  ${phoneDupError
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-line focus:border-accent'}`} />
              {/* 체크 중 스피너 */}
              {phoneChecking && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sub">확인 중...</span>
              )}
            </div>
            {/* 중복 에러 메시지 */}
            {phoneDupError && (
              <div className="mt-1.5 flex items-start gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <span className="text-red-500 text-xs mt-0.5">⚠️</span>
                <div>
                  <p className="text-xs text-red-600 font-medium">{phoneDupError}</p>
                  <p className="text-xs text-red-500 mt-0.5">
                    PIN 초기값은 전화번호 뒷 6자리입니다. 로그인 후 이용해주세요.
                  </p>
                </div>
              </div>
            )}
            {/* 중복 없음 표시 */}
            {!phoneDupError && !phoneChecking && form.phone.replace(/[^0-9]/g, '').length >= 10 && (
              <p className="text-xs text-green-600 mt-1">✅ 사용 가능한 전화번호입니다.</p>
            )}
          </div>

          {/* 소속 클럽 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              소속 클럽 <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.club}
              onChange={e => handleChange('club', e.target.value)}
              placeholder="소속 클럽명"
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5
                focus:border-accent focus:ring-2 focus:ring-accentSoft" />
          </div>

          {/* 랭킹부서 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              랭킹부서 <span className="text-red-500">*</span>
            </label>
            <select value={form.division}
              onChange={e => handleChange('division', e.target.value)}
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5
                focus:border-accent focus:ring-2 focus:ring-accentSoft">
              <option value="">선택하세요</option>
              {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* 등급 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              등급 <span className="text-red-500">*</span>
            </label>
            <select value={form.grade}
              onChange={e => handleChange('grade', e.target.value)}
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5
                focus:border-accent focus:ring-2 focus:ring-accentSoft">
              <option value="">선택하세요</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* 개인정보 동의 */}
          <div className="bg-soft rounded-lg p-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="rounded mt-0.5" />
              <span className="text-sm text-gray-700">
                개인정보 수집 및 이용에 동의합니다.
                <span className="block text-xs text-sub mt-1">
                  수집항목: 이름, 성별, 연락처, 소속클럽 / 이용목적: 동호인회 운영 및 대회 관리
                </span>
              </span>
            </label>
          </div>

          <button type="submit"
            disabled={submitting || !!phoneDupError || phoneChecking}
            className="w-full bg-accent text-white py-3 rounded-lg font-semibold text-sm
              hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? '처리 중...' : '회원 등록 신청'}
          </button>

          <p className="text-xs text-sub text-center">
            가입 후 등록비 납부 시 회원이 활성화됩니다.
          </p>
        </form>
      </div>
    </div>
  )
}