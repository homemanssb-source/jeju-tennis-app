import { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { ToastContext } from '../App'

export default function RegisterPage() {
  const showToast = useContext(ToastContext)
  const [divisions, setDivisions] = useState([])
  const [grades, setGrades] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [form, setForm] = useState({
    name: '', gender: '', phone: '', club: '', division: '', grade: '',
  })

  useEffect(() => { fetchGrades(); fetchDivisions() }, [])

  async function fetchDivisions() {
    // members 테이블 실제 부서값 기준으로 동적 로드 (point_rules와 무관)
    const { data } = await supabase
      .from('members')
      .select('division')
      .not('division', 'is', null)
      .neq('division', '')
    if (data) {
      const unique = [...new Set(data.map(m => m.division).filter(Boolean))].sort()
      setDivisions(unique)
    }
  }

  async function fetchGrades() {
    const { data } = await supabase.rpc('get_grade_options')
    if (data) setGrades(data.map(d => d.grade_value))
  }

  function handleChange(key, value) { setForm({ ...form, [key]: value }) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.gender || !form.phone || !form.club || !form.division || !form.grade) {
      showToast?.('이름, 성별, 전화번호, 소속클럽, 랭킹부서, 등급은 필수입니다.', 'error')
      return
    }
    if (!agreed) { showToast?.('약관에 동의해주세요.', 'error'); return }

    setSubmitting(true)
    const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
    const memberId = 'M' + randomPart
    const nameNorm = form.name.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase()

    const { error } = await supabase.from('members').insert([{
      member_id: memberId, name: form.name, display_name: form.name, name_norm: nameNorm,
      gender: form.gender, phone: form.phone, club: form.club, division: form.division,
      grade: form.grade, status: '휴면', grade_source: 'auto',
      registered_at: new Date().toISOString(),
    }])

    if (error) showToast?.('등록 실패: ' + error.message, 'error')
    else { setSubmitted(true); showToast?.('동호인 등록 신청이 완료되었습니다!') }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="pb-20">
        <PageHeader title="👤 동호인등록" />
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
          <button onClick={() => {
            setSubmitted(false)
            setForm({ name: '', gender: '', phone: '', club: '', division: '', grade: '' })
            setAgreed(false)
          }} className="mt-6 text-sm text-accent hover:underline">
            다른 동호인 등록하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <PageHeader title="👤 동호인등록" subtitle="동호인회 회원 등록 신청" />
      <div className="max-w-lg mx-auto px-5 py-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-amber-700">⚠️ 등록 후 <b>등록비 납부</b>가 확인되면 관리자가 활성화합니다.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)}
              placeholder="실명 입력"
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              성별 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              {['남', '여'].map(g => (
                <button key={g} type="button" onClick={() => handleChange('gender', g)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors
                    ${form.gender === g ? 'bg-accent text-white border-accent' : 'bg-white text-sub border-line hover:bg-soft'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호 <span className="text-red-500">*</span>
            </label>
            <input type="tel" value={form.phone} onChange={e => handleChange('phone', e.target.value)}
              placeholder="010-0000-0000"
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              소속 클럽 <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.club} onChange={e => handleChange('club', e.target.value)}
              placeholder="소속 클럽명"
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              랭킹부서 <span className="text-red-500">*</span>
            </label>
            <select value={form.division} onChange={e => handleChange('division', e.target.value)}
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft">
              <option value="">선택해주세요</option>
              {divisions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              등급 <span className="text-red-500">*</span>
            </label>
            <select value={form.grade} onChange={e => handleChange('grade', e.target.value)}
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft">
              <option value="">선택해주세요</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="bg-soft rounded-lg p-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="rounded mt-0.5" />
              <span className="text-sm text-gray-700">
                개인정보 수집 및 이용에 동의합니다.
                <span className="block text-xs text-sub mt-1">
                  수집항목: 이름, 성별, 연락처, 소속클럽 / 이용목적: 동호인회 운영 및 대회 관리
                </span>
              </span>
            </label>
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-accent text-white py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
            {submitting ? '처리 중...' : '동호인 등록 신청'}
          </button>
          <p className="text-xs text-sub text-center">등록 후 등록비 납부 확인 시 활성화됩니다.</p>
        </form>
      </div>
    </div>
  )
}