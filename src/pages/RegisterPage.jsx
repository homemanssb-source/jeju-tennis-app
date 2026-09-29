import { useState, useEffect, useContext, useRef } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { ToastContext } from '../App'

const DIVISIONS = ['지도자부','마스터부','베테랑부','신인부','여자마스터부','여자베테랑부','여자신인부']

// 등록 구분 — 동호인(랭킹부서/등급) · 선수(생년월일)
const MEMBER_TYPES = [
  { key: '동호인', icon: '🎾', title: '동호인', desc: '클럽 동호인 · 랭킹부서/등급 운영' },
  { key: '선수',   icon: '🏅', title: '선수',   desc: '선수 등록 · 생년월일 기준 관리 · 등록비 면제' },
]

// ✅ 계좌 정보 — 여기만 수정하면 전체 반영됩니다
const BANK_INFO = {
  bank: '제주은행',
  account: '57-01-027381',
  holder: '제주시테니스협회',
  fee: { 동호인: 10000, 선수: 0 },   // 등록비 (원) — 0 이면 면제 (선수는 등록비 면제)
}

// 금액 포맷 (예: 30000 → 30,000원)
const formatFee = (n) => n.toLocaleString('ko-KR') + '원'

// 계좌 안내 박스 (폼 안 + 완료 화면 공통)
function BankInfoBox({ fee, compact = false }) {
  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg ${compact ? 'p-3' : 'p-4'}`}>
      <p className={`font-semibold text-blue-800 mb-2 ${compact ? 'text-xs' : 'text-sm'}`}>
        💰 등록비 납부 안내
      </p>
      <div className={`space-y-1 ${compact ? 'text-xs' : 'text-sm'} text-blue-900`}>
        <div className="flex items-center gap-2">
          <span className="text-blue-500 w-12 shrink-0">은행</span>
          <span className="font-medium">{BANK_INFO.bank}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-blue-500 w-12 shrink-0">계좌</span>
          <span className="font-mono font-bold tracking-wide">{BANK_INFO.account}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-blue-500 w-12 shrink-0">예금주</span>
          <span className="font-medium">{BANK_INFO.holder}</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-blue-200 mt-1">
          <span className="text-blue-500 w-12 shrink-0">금액</span>
          <span className="font-bold text-blue-700">{formatFee(fee)}</span>
        </div>
      </div>
      <p className={`mt-2 text-blue-600 ${compact ? 'text-xs' : 'text-xs'}`}>
        ※ 입금자명은 <b>본인 이름</b>으로 해주세요.
      </p>
    </div>
  )
}

// 등록비 면제 안내 박스 (선수)
function FeeExemptBox({ compact = false }) {
  return (
    <div className={`bg-green-50 border border-green-200 rounded-lg ${compact ? 'p-3' : 'p-4'}`}>
      <p className={`font-semibold text-green-800 ${compact ? 'text-xs' : 'text-sm'}`}>
        🎁 선수는 등록비가 면제됩니다
      </p>
      <p className="mt-1 text-xs text-green-700">별도 입금 없이 등록 신청만 하시면 됩니다.</p>
    </div>
  )
}

// ── 클럽 콤보박스 ─────────────────────────────────────
function ClubComboBox({ value, onChange, placeholder = '클럽명 선택 또는 직접 입력' }) {
  const [open, setOpen] = useState(false)
  const [inputVal, setInputVal] = useState(value || '')
  const [clubs, setClubs] = useState([])
  const wrapRef = useRef(null)

  useEffect(() => {
    supabase.from('members_public').select('club').neq('status', '삭제')
      .then(({ data }) => {
        if (!data) return
        const unique = [...new Set(data.map(r => r.club).filter(Boolean))].sort()
        setClubs(unique)
      })
  }, [])

  useEffect(() => { setInputVal(value || '') }, [value])

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = clubs.filter(c =>
    c.toLowerCase().includes(inputVal.trim().toLowerCase())
  )

  function handleInput(e) {
    setInputVal(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  function handleSelect(club) {
    setInputVal(club)
    onChange(club)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={inputVal}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full text-sm border border-line rounded-lg px-3 py-2.5 pr-8
            focus:border-accent focus:ring-2 focus:ring-accentSoft"
        />
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-sub text-xs"
        >▾</button>
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-line rounded-lg shadow-lg z-[60] max-h-48 overflow-y-auto">
          {inputVal.trim() && !clubs.includes(inputVal.trim()) && (
            <button
              type="button"
              onClick={() => handleSelect(inputVal.trim())}
              className="w-full text-left px-3 py-2 text-sm text-accent hover:bg-soft border-b border-line/30"
            >
              + "{inputVal.trim()}" 직접 입력
            </button>
          )}
          {filtered.length === 0 && inputVal.trim() && (
            <p className="px-3 py-2 text-xs text-sub">일치하는 소속 없음 — 직접 입력하세요</p>
          )}
          {filtered.length === 0 && !inputVal.trim() && clubs.length === 0 && (
            <p className="px-3 py-2 text-xs text-sub">불러오는 중...</p>
          )}
          {filtered.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => handleSelect(c)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-soft border-b border-line/30
                ${c === value ? 'bg-accentSoft text-accent font-medium' : 'text-gray-800'}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const EMPTY_FORM = { name: '', gender: '', phone: '', guardian_phone: '', club: '', division: '', grade: '', birthdate: '' }

export default function RegisterPage() {
  const showToast = useContext(ToastContext)
  const [memberType, setMemberType] = useState('동호인')
  const [grades, setGrades] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [agreed, setAgreed] = useState(false)
  // ✅ 추가: 전화번호 중복 체크 상태
  const [phoneChecking, setPhoneChecking] = useState(false)
  const [phoneDupError, setPhoneDupError] = useState('')
  const [phoneOk, setPhoneOk] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const isPlayer = memberType === '선수'
  const fee = BANK_INFO.fee[memberType]
  const feeExempt = !fee   // 등록비 면제 여부 (선수)

  useEffect(() => { fetchGrades() }, [])

  async function fetchGrades() {
    const { data } = await supabase.rpc('get_grade_options')
    if (data) setGrades(data.map(d => d.grade_value))
  }

  function handleChange(key, value) {
    setForm({ ...form, [key]: value })
    // ✅ 전화번호 변경 시 체크 상태 초기화
    if (key === 'phone') {
      setPhoneDupError('')
      setPhoneOk(false)
    }
  }

  // ✅ 하이픈 제거 (숫자만 추출)
  function normalizePhone(phone) {
    return phone.replace(/[^0-9]/g, '')
  }

  // ✅ 하이픈 포함 형식으로 변환 010-1234-5678
  function formatPhoneWithDash(phoneNorm) {
    return phoneNorm.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3')
  }

  // ✅ 전화번호 포커스 아웃 시 중복 체크
  // DB에 하이픈 있음/없음 두 형식이 혼재하므로 둘 다 조회
  async function handlePhoneBlur() {
    const phoneNorm = normalizePhone(form.phone)
    if (phoneNorm.length < 10) return

    setPhoneChecking(true)
    setPhoneDupError('')
    setPhoneOk(false)

    const phoneWithDash = formatPhoneWithDash(phoneNorm)
    const { data } = await supabase
      .from('members')
      .select('member_id, name, status')
      .or(`phone.eq.${phoneNorm},phone.eq.${phoneWithDash}`)
      .neq('status', '삭제')
      .limit(1)

    setPhoneChecking(false)

    if (data && data.length > 0) {
      const m = data[0]
      const statusLabel =
        m.status === '활성' ? '활성 회원' :
        m.status === '휴면' ? '가입 대기 중' : m.status
      setPhoneDupError(`이미 등록된 전화번호입니다. (${m.name} · ${statusLabel})`)
      setPhoneOk(false)
    } else {
      setPhoneDupError('')
      setPhoneOk(true)
    }
  }

  function validate() {
    if (!form.name || !form.gender || !form.club) {
      return '이름, 성별, 소속은 필수입니다.'
    }
    if (isPlayer) {
      // 선수: 보호자 연락처 필수, 본인 연락처는 선택 (형제 선수가 보호자 번호를 공유할 수 있음)
      if (normalizePhone(form.guardian_phone).length < 10) return '보호자 연락처를 입력해주세요.'
      if (form.phone && normalizePhone(form.phone).length < 10) return '선수 연락처를 확인해주세요.'
      if (!form.birthdate) return '생년월일을 입력해주세요.'
      const d = new Date(form.birthdate)
      if (isNaN(d.getTime()) || d > new Date() || d.getFullYear() < 1900) return '생년월일을 확인해주세요.'
    } else {
      if (!form.phone) return '전화번호는 필수입니다.'
      if (!form.division || !form.grade) return '랭킹부서, 등급은 필수입니다.'
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const invalid = validate()
    if (invalid) { showToast?.(invalid, 'error'); return }
    if (!agreed) { showToast?.('약관에 동의해주세요.', 'error'); return }
    // ✅ 중복 에러 있으면 제출 차단
    if (phoneDupError) { showToast?.('전화번호를 확인해주세요.', 'error'); return }

    setSubmitting(true)

    // ✅ 제출 직전 최종 이중 방어 체크 (본인 연락처가 있을 때만)
    const phoneNorm = normalizePhone(form.phone)
    const guardianNorm = normalizePhone(form.guardian_phone)
    if (phoneNorm) {
      const phoneWithDash = formatPhoneWithDash(phoneNorm)
      const { data: existing } = await supabase
        .from('members')
        .select('member_id, name, status')
        .or(`phone.eq.${phoneNorm},phone.eq.${phoneWithDash}`)
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
    }

    const memberId = 'M' + Date.now().toString().slice(-8)
    const nameNorm = form.name.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase()

    const { error } = await supabase.from('members').insert([{
      member_id: memberId,
      name: form.name,
      display_name: form.name,
      name_norm: nameNorm,
      gender: form.gender,
      phone: phoneNorm || null,   // ✅ 항상 하이픈 없이 저장 (통일), 선수는 없을 수 있음
      guardian_phone: isPlayer ? (guardianNorm || null) : null,
      // 선수 본인 번호가 없으면 PIN 이 자동 생성되지 않으므로 보호자 번호 뒷 6자리로 지정
      ...(isPlayer && { pin_code: (phoneNorm || guardianNorm).slice(-6) }),
      club: form.club,
      member_type: memberType,
      // 선수는 랭킹부서/등급 없음, 동호인은 생년월일 없음
      division: isPlayer ? null : form.division,
      grade: isPlayer ? null : form.grade.replace(/점$/, ''),
      birthdate: isPlayer ? form.birthdate : null,
      status: '휴면',
      grade_source: 'auto',
      registered_at: new Date().toISOString(),
    }])

    if (error) {
      // ✅ DB UNIQUE 제약 위반 시 친절한 메시지
      if (error.code === '23505') {
        setPhoneDupError('이미 등록된 전화번호입니다.')
        showToast?.('이미 등록된 전화번호입니다.', 'error')
      } else {
        showToast?.('등록 실패: ' + error.message, 'error')
      }
    } else {
      setSubmitted(true)
      showToast?.(`${memberType} 등록 신청이 완료되었습니다!`)
    }
    setSubmitting(false)
  }

  function resetAll() {
    setSubmitted(false)
    setForm(EMPTY_FORM)
    setAgreed(false)
    setPhoneDupError('')
    setPhoneOk(false)
  }

  function switchType(key) {
    if (key === memberType) return
    setMemberType(key)
    // 구분 전용 필드만 초기화 (공통 입력값은 유지)
    setForm(f => ({ ...f, division: '', grade: '', birthdate: '' }))
  }

  // ── 완료 화면 ──────────────────────────────────────────
  if (submitted) {
    return (
      <div className="pb-20">
        <PageHeader title="👤 동호인/선수 등록" />
        <div className="max-w-lg mx-auto px-5 py-10 text-center">
          <p className="text-5xl mb-4">🎉</p>
          <h2 className="text-lg font-bold text-gray-900 mb-1">{memberType} 등록 신청 완료!</h2>
          <p className="text-sm text-sub mb-5">
            {feeExempt ? '관리자 확인 후 활성화됩니다.' : '등록비 납부 후 활성화됩니다.'}
          </p>

          {feeExempt ? <FeeExemptBox /> : <BankInfoBox fee={fee} />}

          <div className="bg-soft rounded-lg p-3 mt-3 text-left">
            <p className="text-xs text-sub">
              {feeExempt ? '등록 정보 확인 후 관리자가 활성화합니다.' : '입금 확인 후 관리자가 활성화합니다.'} 문의는 협회로 연락해주세요.
              {isPlayer && ' PIN 초기값은 선수 본인(없으면 보호자) 연락처 뒷 6자리입니다.'}
            </p>
          </div>

          <button onClick={resetAll} className="mt-6 text-sm text-accent hover:underline">
            다른 {memberType} 등록하기
          </button>
        </div>
      </div>
    )
  }

  // ── 등록 폼 ────────────────────────────────────────────
  return (
    <div className="pb-20">
      <PageHeader title="👤 동호인/선수 등록" subtitle="제주시테니스협회 등록 신청" />
      <div className="max-w-lg mx-auto px-5 py-4">

        {/* 등록 구분 선택 */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {MEMBER_TYPES.map(t => {
            const active = memberType === t.key
            return (
              <button key={t.key} type="button" onClick={() => switchType(t.key)}
                className={`rounded-xl border-2 p-3 text-left transition-colors
                  ${active ? 'border-accent bg-accentSoft' : 'border-line bg-white hover:bg-soft'}`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">{t.icon}</span>
                  <span className={`text-sm font-bold ${active ? 'text-accent' : 'text-gray-800'}`}>{t.title}</span>
                  {active && <span className="ml-auto text-accent text-xs">✓</span>}
                </div>
                <p className="text-[11px] text-sub mt-1 leading-snug">{t.desc}</p>
              </button>
            )
          })}
        </div>

        {/* 등록비 안내 — 폼 상단 (선수는 면제) */}
        {feeExempt ? <FeeExemptBox compact /> : <BankInfoBox fee={fee} compact />}
        <div className="mt-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-700">
            {feeExempt
              ? <>⚠️ 등록 후 <b>관리자 확인</b>을 거쳐 활성화됩니다.</>
              : <>⚠️ 등록 후 <b>등록비 납부</b>가 확인되면 관리자가 활성화합니다.</>}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)}
              placeholder="실명 입력"
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft" />
          </div>

          {/* 성별 */}
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

          {/* 선수 전용: 생년월일 */}
          {isPlayer && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                생년월일 <span className="text-red-500">*</span>
              </label>
              <input type="date" value={form.birthdate}
                onChange={e => handleChange('birthdate', e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft" />
              <p className="text-xs text-sub mt-1">연령별 부서 편성 기준으로 사용됩니다.</p>
            </div>
          )}

          {/* 선수 전용: 보호자 연락처 (필수) — 형제 선수가 같은 번호를 써도 됨 */}
          {isPlayer && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                보호자 연락처 <span className="text-red-500">*</span>
              </label>
              <input type="tel" value={form.guardian_phone}
                onChange={e => handleChange('guardian_phone', e.target.value)}
                placeholder="010-0000-0000"
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft" />
              <p className="text-xs text-sub mt-1">성인 선수는 본인 번호를 입력해도 됩니다.</p>
            </div>
          )}

          {/* ✅ 전화번호 — 중복 체크 추가 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isPlayer ? (
                <>선수 본인 연락처 <span className="text-xs font-normal text-sub">(선택 — 휴대폰이 없으면 비워두세요)</span></>
              ) : (
                <>전화번호 <span className="text-red-500">*</span></>
              )}
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
                    : phoneOk
                      ? 'border-green-400 focus:border-green-400'
                      : 'border-line focus:border-accent'}`} />
              {phoneChecking && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sub">
                  확인 중...
                </span>
              )}
            </div>
            {/* 중복 에러 메시지 */}
            {phoneDupError && (
              <div className="mt-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-xs text-red-600 font-medium">⚠️ {phoneDupError}</p>
                <p className="text-xs text-red-500 mt-0.5">
                  PIN 초기값은 전화번호 뒷 6자리입니다. 기존 계정으로 이용해주세요.
                </p>
              </div>
            )}
            {/* 사용 가능 메시지 */}
            {phoneOk && !phoneDupError && (
              <p className="text-xs text-green-600 mt-1">✅ 사용 가능한 전화번호입니다.</p>
            )}
          </div>

          {/* 소속 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isPlayer ? '소속 (학교 · 클럽 · 팀)' : '소속 클럽'} <span className="text-red-500">*</span>
            </label>
            <ClubComboBox
              value={form.club}
              onChange={val => handleChange('club', val)}
              placeholder={isPlayer ? '소속 선택 또는 직접 입력' : '클럽명 선택 또는 직접 입력'}
            />
          </div>

          {/* 동호인 전용: 랭킹부서 · 등급 */}
          {!isPlayer && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  랭킹부서 <span className="text-red-500">*</span>
                </label>
                <select value={form.division} onChange={e => handleChange('division', e.target.value)}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft">
                  <option value="">선택하세요</option>
                  {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  등급 <span className="text-red-500">*</span>
                </label>
                <select value={form.grade} onChange={e => handleChange('grade', e.target.value)}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft">
                  <option value="">선택하세요</option>
                  {grades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </>
          )}

          {/* 개인정보 동의 */}
          <div className="bg-soft rounded-lg p-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="rounded mt-0.5" />
              <span className="text-sm text-gray-700">
                개인정보 수집 및 이용에 동의합니다.
                <span className="block text-xs text-sub mt-1">
                  수집항목: 이름, 성별, 연락처, 소속{isPlayer ? ', 생년월일, 보호자 연락처' : ''} / 이용목적: 협회 운영 및 대회 관리
                </span>
                <a href="/privacy" target="_blank" rel="noopener noreferrer"
                  className="block text-xs text-blue-500 underline mt-1"
                  onClick={e => e.stopPropagation()}>
                  개인정보처리방침 전문 보기
                </a>
              </span>
            </label>
          </div>

          {/* ✅ 중복 에러 또는 체크 중이면 버튼 비활성화 */}
          <button type="submit"
            disabled={submitting || !!phoneDupError || phoneChecking}
            className="w-full bg-accent text-white py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? '처리 중...' : `${memberType} 등록 신청 (${feeExempt ? '등록비 면제' : `등록비 ${formatFee(fee)}`})`}
          </button>

          <p className="text-xs text-sub text-center">
            {feeExempt ? '등록 후 관리자 확인 시 활성화됩니다.' : '등록 후 등록비 납부 확인 시 활성화됩니다.'}
          </p>
        </form>
      </div>
    </div>
  )
}
