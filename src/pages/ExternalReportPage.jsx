import { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { ToastContext } from '../App'

const TOURNAMENT_TYPES = ['전국대회', '도내대회']
const RESULTS = ['우승', '준우승', '4강']
const DIVISIONS = ['지도자부', '마스터부', '베테랑부', '신인부', '여자마스터부', '여자베테랑부', '여자신인부']

// [버그1 수정] 실제 DB result_condition 값 기준: '입상' | '결승' | '우승'
const RESULT_TO_CONDITION = {
  '우승': '우승',
  '준우승': '결승',
  '4강': '입상',
}

export default function ExternalReportPage() {
  const showToast = useContext(ToastContext)

  const [tab, setTab] = useState('report')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [member, setMember] = useState(null)
  const [searching, setSearching] = useState(false)

  const [tournamentName, setTournamentName] = useState('')
  const [tournamentDate, setTournamentDate] = useState('')
  const [tournamentType, setTournamentType] = useState('')
  const [tournamentDivision, setTournamentDivision] = useState('') // [버그5] 참가부서
  const [result, setResult] = useState('')
  const [expectedGrade, setExpectedGrade] = useState(null)
  const [promotionRules, setPromotionRules] = useState([])

  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showDupModal, setShowDupModal] = useState(false)

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => { fetchPromotionRules() }, [])

  useEffect(() => {
    if (member && result && tournamentType) calcExpectedGrade()
    else setExpectedGrade(null)
  }, [result, tournamentType, member, promotionRules])

  async function fetchPromotionRules() {
    const { data } = await supabase.from('promotion_rules').select('*')
    setPromotionRules(data || [])
  }

  function calcExpectedGrade() {
    if (!member || !result || !promotionRules.length) return
    const condition = RESULT_TO_CONDITION[result]
    // "4.5점" 같은 문자 포함된 경우 숫자만 추출
    const currentGrade = parseFloat(String(member.grade).replace(/[^0-9.]/g, ''))
    const matched = promotionRules.find(r => {
      const genderMatch = r.gender === member.gender
      const scoreMatch = Number(r.current_score) === currentGrade
      const conditionMatch = r.result_condition === condition
      const typeMatch = r.tournament_type === '(전체)' || r.tournament_type === tournamentType
      return genderMatch && scoreMatch && conditionMatch && typeMatch
    })
    setExpectedGrade(matched ? matched.next_score : null)
  }

  async function handleSearchMember() {
    const trimName = name.trim()
    const trimPhone = phone.trim().replace(/-/g, '')
    if (!trimName || !trimPhone) {
      showToast?.('이름과 전화번호를 모두 입력해주세요.', 'error')
      return
    }
    setSearching(true)
    setMember(null)
    // RPC 함수 사용 (SECURITY DEFINER → RLS 우회)
    const { data, error } = await supabase.rpc('rpc_find_member_by_name_phone', {
      p_name: trimName,
      p_phone: trimPhone,
    })
    setSearching(false)
    if (error) {
      showToast?.('조회 실패: ' + error.message, 'error')
      return
    }
    if (!data?.ok) {
      showToast?.(data?.message || '일치하는 활성 회원을 찾을 수 없습니다.', 'error')
      return
    }
    setMember(data)
    showToast?.(`${data.display_name || data.name} 회원 확인됩니다.`)
  }

  async function handleSubmitClick() {
    if (!member) { showToast?.('먼저 회원 조회를 해주세요.', 'error'); return }
    if (!tournamentName.trim()) { showToast?.('대회명을 입력해주세요.', 'error'); return }
    if (!tournamentDate) { showToast?.('대회 날짜를 입력해주세요.', 'error'); return }
    if (!tournamentType) { showToast?.('대회 구분을 선택해주세요.', 'error'); return }
    if (!result) { showToast?.('결과를 선택해주세요.', 'error'); return }

    const { data: dup } = await supabase
      .from('external_report_log')
      .select('id')
      .eq('member_id', member.member_id)
      .eq('tournament_name', tournamentName.trim())
      .limit(1)

    if (dup && dup.length > 0) { setShowDupModal(true); return }
    setShowPinModal(true)
  }

  async function handlePinConfirm() {
    if (pin.length !== 6) { showToast?.('PIN 6자리를 입력해주세요.', 'error'); return }
    setSubmitting(true)

    // [버그2 수정] ok 여부 먼저 체크 후 member_id 비교
    const { data: pinData, error: pinError } = await supabase.rpc('rpc_verify_member_pin', {
      p_name: member.name,
      p_pin: pin,
    })
    if (pinError || !pinData?.ok) {
      showToast?.('⚠️ PIN이 올바르지 않습니다.', 'error')
      setSubmitting(false)
      return
    }
    if (pinData.member_id && pinData.member_id !== member.member_id) {
      showToast?.('⚠️ PIN 정보가 일치하지 않습니다. 전화번호를 다시 확인해주세요.', 'error')
      setSubmitting(false)
      return
    }
    await doSubmit()
  }

  async function doSubmit() {
    const { error } = await supabase.from('external_report_log').insert([{
      member_id: member.member_id,
      member_name: member.display_name || member.name,
      member_phone: member.phone,
      tournament_name: tournamentName.trim(),
      tournament_date: tournamentDate,
      tournament_type: tournamentType,
      tournament_division: tournamentDivision || null, // [버그5] 참가부서
      result,
      before_grade: Number(member.grade) || null,
      expected_grade: expectedGrade ?? null,
    }])

    if (error) { showToast?.('신고 실패: ' + error.message, 'error'); setSubmitting(false); return }

    showToast?.('✅ 외부대회 입상 신고가 완료되었습니다!')
    setShowPinModal(false)
    setShowDupModal(false)
    setPin('')
    setTournamentName(''); setTournamentDate(''); setTournamentType('')
    setTournamentDivision(''); setResult(''); setExpectedGrade(null)
    setSubmitting(false)
  }

  async function fetchHistory() {
    if (!member) { showToast?.('신고 탭에서 회원 조회 먼저 해주세요.', 'error'); return }
    setHistoryLoading(true)
    const { data } = await supabase
      .from('external_report_log')
      .select('*')
      .eq('member_id', member.member_id)
      .order('reported_at', { ascending: false })
    setHistory(data || [])
    setHistoryLoading(false)
  }

  function handleTabChange(t) {
    setTab(t)
    if (t === 'history') fetchHistory()
  }

  const gradeChanged = expectedGrade !== null && Number(expectedGrade) !== Number(member?.grade)

  return (
    <div className="pb-20">
      <PageHeader title="🏆 외부대회 신고" subtitle="타 주관 대회 입상 결과 신고" />
      <div className="max-w-lg mx-auto px-5">

        <div className="flex gap-1 mb-4 mt-2 bg-soft rounded-lg p-1">
          {[{ key: 'report', label: '📝 입상 신고' }, { key: 'history', label: '📋 내 신고 이력' }].map(t => (
            <button key={t.key} onClick={() => handleTabChange(t.key)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors
                ${tab === t.key ? 'bg-white text-accent shadow-sm' : 'text-sub'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'report' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700 leading-relaxed">
                📌 JTA 주관 외 타 대회에서 입상하신 경우 신고해주세요.<br />관리자 검토 후 등급에 반영됩니다.
              </p>
            </div>

            <div className="bg-white border border-line rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800">① 회원 확인</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-sub mb-1">이름</label>
                  <input type="text" value={name} onChange={e => { setName(e.target.value); setMember(null) }}
                    placeholder="홍길동"
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-xs text-sub mb-1">전화번호</label>
                  <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setMember(null) }}
                    placeholder="01012345678"
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent" />
                </div>
              </div>
              <button onClick={handleSearchMember} disabled={searching}
                className="w-full bg-accent text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {searching ? '조회 중...' : '회원 조회'}
              </button>
              {member && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-800">✅ {member.display_name || member.name}</p>
                    <p className="text-xs text-green-600 mt-0.5">{member.division} · 현재 등급: <span className="font-bold">{member.grade}</span></p>
                  </div>
                  <button onClick={() => setMember(null)} className="text-xs text-green-600 hover:text-green-800">변경</button>
                </div>
              )}
            </div>

            {member && (
              <div className="bg-white border border-line rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800">② 대회 정보 입력</p>
                <div>
                  <label className="block text-xs text-sub mb-1">대회명</label>
                  <input type="text" value={tournamentName} onChange={e => setTournamentName(e.target.value)}
                    placeholder="예: 2025 전라남도오픈 테니스대회"
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-xs text-sub mb-1">대회 날짜</label>
                  <input type="date" value={tournamentDate} onChange={e => setTournamentDate(e.target.value)}
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-sub mb-1">대회 구분</label>
                    <select value={tournamentType} onChange={e => setTournamentType(e.target.value)}
                      className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-accent">
                      <option value="">선택</option>
                      {TOURNAMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-sub mb-1">결과</label>
                    <select value={result} onChange={e => setResult(e.target.value)}
                      className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-accent">
                      <option value="">선택</option>
                      {RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-sub mb-1">참가 부서 <span className="text-gray-400">(선택)</span></label>
                  <select value={tournamentDivision} onChange={e => setTournamentDivision(e.target.value)}
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-accent">
                    <option value="">선택 안함</option>
                    {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                {result && tournamentType && (
                  <div className={`rounded-lg p-3 border ${gradeChanged ? 'bg-amber-50 border-amber-200' : 'bg-soft border-line'}`}>
                    <p className="text-xs font-medium text-gray-700 mb-1">📊 등급 변경 예상</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">{member.grade}</span>
                      <span className="text-sub">→</span>
                      {gradeChanged ? (
                        <span className="text-sm font-bold text-accent">
                          {expectedGrade}<span className="text-xs font-normal text-amber-600 ml-1">(승급 대상)</span>
                        </span>
                      ) : (
                        <span className="text-sm text-sub">
                          {expectedGrade === null ? '해당 룰 없음 (관리자 검토)' : `${expectedGrade} (변동 없음)`}
                        </span>
                      )}
                    </div>
                    {gradeChanged && <p className="text-xs text-amber-600 mt-1">※ 관리자 검토 후 최종 반영됩니다.</p>}
                  </div>
                )}
                <button onClick={handleSubmitClick}
                  className="w-full bg-accent text-white py-3 rounded-lg text-sm font-semibold hover:bg-blue-700">
                  신고 제출 (PIN 확인)
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-3">
            {!member ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">🔍</p>
                <p className="text-sm text-sub">신고 탭에서 회원 조회 후 이력을 확인하세요.</p>
              </div>
            ) : historyLoading ? (
              <div className="text-center py-10 text-sm text-sub">로딩 중...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm text-sub">신고 이력이 없습니다.</p>
              </div>
            ) : history.map(h => (
              <div key={h.id} className="bg-white border border-line rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{h.tournament_name}</p>
                    <p className="text-xs text-sub mt-0.5">
                      {h.tournament_date} · {h.tournament_type} · {h.result}
                      {h.tournament_division ? ` · ${h.tournament_division}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ml-2
                    ${h.admin_applied ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {h.admin_applied ? '✅ 반영됨' : '🟡 검토중'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-sub">
                  <span>신고 등급: <b className="text-gray-700">{h.before_grade}</b></span>
                  {h.expected_grade && Number(h.expected_grade) !== Number(h.before_grade) && (
                    <><span>→</span><span>예상: <b className="text-accent">{h.expected_grade}</b></span></>
                  )}
                </div>
                {h.admin_note && (
                  <p className="text-xs text-gray-500 bg-soft rounded px-2 py-1">💬 관리자 메모: {h.admin_note}</p>
                )}
                <p className="text-[10px] text-sub">신고일: {new Date(h.reported_at).toLocaleDateString('ko-KR')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowPinModal(false); setPin('') }} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900 text-center">🔐 PIN 확인</h3>
            <p className="text-sm text-sub text-center">본인 확인을 위해 PIN 6자리를 입력해주세요.</p>
            <input type="password" value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="PIN 6자리" maxLength={6} autoFocus
              className="w-full text-center text-xl tracking-widest border border-line rounded-xl px-4 py-3 focus:outline-none focus:border-accent" />
            <p className="text-xs text-sub text-center">PIN 초기값은 전화번호 뒷 6자리입니다.</p>
            <div className="flex gap-2">
              <button onClick={() => { setShowPinModal(false); setPin('') }}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">취소</button>
              <button onClick={handlePinConfirm} disabled={submitting || pin.length !== 6}
                className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {submitting ? '처리 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDupModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900 text-center">⚠️ 중복 신고 확인</h3>
            <p className="text-sm text-gray-700 text-center leading-relaxed">
              <b>"{tournamentName}"</b> 대회는 이미 신고된 기록이 있습니다.<br />그래도 다시 제출하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowDupModal(false)}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">취소</button>
              <button onClick={() => { setShowDupModal(false); setShowPinModal(true) }}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600">계속 제출</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
