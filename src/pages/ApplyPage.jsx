// src/pages/ApplyPage.jsx
// 신청확인: 전체 목록 + 내 신청 내역 (전화번호+PIN 인증)
import { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { ToastContext } from '../App'

export default function ApplyPage() {
  const showToast = useContext(ToastContext)
  const [tab, setTab] = useState('all') // 'all' | 'mine'

  // ── 전체 신청 현황 ──
  const [events, setEvents]                   = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [entries, setEntries]                 = useState([])
  const [teamEntries, setTeamEntries]         = useState([])
  const [loading, setLoading]                 = useState(false)
  const [activeDivision, setActiveDivision]     = useState('전체')
  const [activeTeamDivision, setActiveTeamDivision] = useState('전체')

  // ── 내 신청 내역 ──
  const [phone, setPhone]           = useState('')
  const [pin, setPin]               = useState('')
  const [myEntries, setMyEntries]   = useState([])
  const [myName, setMyName]         = useState('')
  const [myLoading, setMyLoading]   = useState(false)
  const [myError, setMyError]       = useState('')
  const [mySearched, setMySearched] = useState(false)

  // ── 취소 모달 ──
  const [cancelTarget, setCancelTarget]   = useState(null)
  const [refundBank, setRefundBank]       = useState('')
  const [refundAccount, setRefundAccount] = useState('')
  const [refundHolder, setRefundHolder]   = useState('')
  const [cancelling, setCancelling]       = useState(false)

  // ── 파트너 변경 모달 ──
  const [partnerTarget, setPartnerTarget]         = useState(null) // entry 객체
  const [partnerSearch, setPartnerSearch]         = useState('')
  const [partnerResults, setPartnerResults]       = useState([])
  const [partnerSelected, setPartnerSelected]     = useState(null) // { member_id, name, club }
  const [partnerSearching, setPartnerSearching]   = useState(false)
  const [partnerSaving, setPartnerSaving]         = useState(false)

  // ── 단체전 선수명단 보기 모달 ──
  const [rosterViewTarget, setRosterViewTarget]   = useState(null) // team_event_entries row
  const [rosterViewMembers, setRosterViewMembers] = useState([])
  const [rosterViewLoading, setRosterViewLoading] = useState(false)

  // ── 단체전 명단 수정 모달 (내 신청 내역용) ──
  const [rosterEditTarget, setRosterEditTarget]   = useState(null) // my team entry row
  const [rosterEditMembers, setRosterEditMembers] = useState([])
  const [rosterEditLoading, setRosterEditLoading] = useState(false)
  const [rosterEditSaving, setRosterEditSaving]   = useState(false)
  const [rosterEditSearch, setRosterEditSearch]   = useState('')
  const [rosterEditResults, setRosterEditResults] = useState([])
  const [rosterEditSearching, setRosterEditSearching] = useState(false)
  // 주장 PIN 인증 (명단 수정)
  const [rosterEditPin, setRosterEditPin]         = useState('')
  const [rosterEditPinVerified, setRosterEditPinVerified] = useState(false)
  const [rosterEditPinLoading, setRosterEditPinLoading] = useState(false)

  // ── 내 단체전 신청 내역 ──
  const [myTeamEntries, setMyTeamEntries]         = useState([])

  useEffect(() => { fetchEvents() }, [])
  useEffect(() => { if (selectedEventId) { fetchEntries(); fetchTeamEntries() } }, [selectedEventId])

  async function fetchEvents() {
    const { data, error } = await supabase.from('events')
      .select('*').order('event_date', { ascending: true })
    if (error || !data || data.length === 0) { setEvents([]); return }
    setEvents(data)
    const today = new Date().toISOString().slice(0, 10)
    const upcoming = data.find(e => e.event_date >= today)
    setSelectedEventId((upcoming || data[data.length - 1]).event_id)
  }

  async function fetchEntries() {
    setLoading(true)
    setActiveDivision('전체')
    setActiveTeamDivision('전체')
    const { data } = await supabase
      .from('event_entries')
      .select('*, teams ( team_name, member1_id, member2_id ), event_divisions ( division_name )')
      .eq('event_id', selectedEventId)
      .neq('entry_status', '취소')
      .order('applied_at', { ascending: false })

    // ★ member_id → club 조회
    const memberIds = [...new Set(
      (data || []).flatMap(e => [e.teams?.member1_id, e.teams?.member2_id].filter(Boolean))
    )]
    let memberClubMap = {}
    if (memberIds.length > 0) {
      const { data: membersData } = await supabase
        .from('members')
        .select('member_id, name, club')
        .in('member_id', memberIds)
      for (const m of (membersData || [])) {
        memberClubMap[m.member_id] = { name: m.name, club: m.club }
      }
    }
    // ★ 각 entry에 club 정보 첨부
    for (const e of (data || [])) {
      e._m1 = e.teams?.member1_id ? memberClubMap[e.teams.member1_id] : null
      e._m2 = e.teams?.member2_id ? memberClubMap[e.teams.member2_id] : null
    }

    setEntries(data || [])
    setLoading(false)
  }

  // ★ 단체전 팀 조회 (대기+확정 모두, 취소만 제외)
  async function fetchTeamEntries() {
    const { data } = await supabase
      .from('team_event_entries')
      .select('*')
      .eq('event_id', selectedEventId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
    setTeamEntries(data || [])
  }

  // ── 단체전 선수명단 보기 ──
  async function openRosterView(team) {
    setRosterViewTarget(team)
    setRosterViewMembers([])
    setRosterViewLoading(true)
    const { data } = await supabase
      .from('team_event_members')
      .select('*')
      .eq('entry_id', team.id)
      .order('member_order')
    setRosterViewMembers(data || [])
    setRosterViewLoading(false)
  }
  function closeRosterView() { setRosterViewTarget(null); setRosterViewMembers([]) }

  // ── 내 단체전 신청 조회 ──
  async function fetchMyTeamEntries(cleanPhone, cleanPin) {
    // captain_name + pin 으로 본인 소속 팀 찾기
    // 전화번호로 member 조회 후 team_event_members에서 entry_id 검색
    const { data: memberRows } = await supabase
      .from('members')
      .select('member_id')
      .eq('phone', cleanPhone)
    const memberId = memberRows?.[0]?.member_id
    if (!memberId) { setMyTeamEntries([]); return }

    const { data: memEntries } = await supabase
      .from('team_event_members')
      .select('entry_id')
      .eq('member_id', memberId)
    const entryIds = (memEntries || []).map(r => r.entry_id)
    if (entryIds.length === 0) { setMyTeamEntries([]); return }

    const { data: teamRows } = await supabase
      .from('team_event_entries')
      .select('*, events(event_name, event_date, entry_close_at)')
      .in('id', entryIds)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
    setMyTeamEntries((teamRows || []).map(r => ({ ...r, _my_member_id: memberId })))
  }

  // ── 단체전 명단 수정 모달 열기 ──
  async function openRosterEdit(teamEntry) {
    const closeAt = teamEntry.events?.entry_close_at
    if (closeAt && new Date(closeAt) < new Date()) {
      showToast('접수 마감 후에는 명단을 수정할 수 없습니다.', 'error'); return
    }
    setRosterEditTarget(teamEntry)
    setRosterEditPin('')
    setRosterEditPinVerified(false)
    setRosterEditSearch('')
    setRosterEditResults([])
    setRosterEditLoading(true)
    const { data } = await supabase
      .from('team_event_members')
      .select('*')
      .eq('entry_id', teamEntry.id)
      .order('member_order')
    setRosterEditMembers(data || [])
    setRosterEditLoading(false)
  }
  function closeRosterEdit() {
    setRosterEditTarget(null); setRosterEditMembers([])
    setRosterEditPin(''); setRosterEditPinVerified(false)
    setRosterEditSearch(''); setRosterEditResults([])
  }

  // 주장 PIN 인증
  async function handleRosterEditPinVerify() {
    if (!rosterEditTarget || rosterEditPin.length !== 6) {
      showToast('PIN 6자리를 입력해주세요.', 'error'); return
    }
    setRosterEditPinLoading(true)
    const { data, error } = await supabase.rpc('rpc_verify_member_pin', {
      p_name: rosterEditTarget.captain_name || '',
      p_pin: rosterEditPin,
    })
    setRosterEditPinLoading(false)
    if (error || !data?.ok) {
      showToast('PIN 인증 실패: ' + (data?.message || error?.message || '오류'), 'error'); return
    }
    setRosterEditPinVerified(true)
    showToast('✅ 인증 완료')
  }

  // 선수 검색 (명단 수정)
  async function handleRosterEditSearch() {
    const q = rosterEditSearch.trim()
    if (!q) return
    setRosterEditSearching(true)
    const { data } = await supabase
      .from('members')
      .select('member_id, name, club, grade, gender, status')
      .ilike('name', `%${q}%`)
      .eq('status', '활성')
      .limit(20)
    setRosterEditSearching(false)
    const currentIds = new Set(rosterEditMembers.map(m => m.member_id).filter(Boolean))
    setRosterEditResults((data || []).map(m => ({
      ...m,
      disabled: currentIds.has(m.member_id),
      disabledReason: currentIds.has(m.member_id) ? '이미 명단에 있음' : '',
    })))
  }

  function handleRosterEditAdd(m) {
    if (rosterEditMembers.find(r => r.member_id === m.member_id)) {
      showToast('이미 명단에 있습니다.', 'error'); return
    }
    setRosterEditMembers(prev => [...prev, {
      id: null, entry_id: rosterEditTarget.id,
      member_id: m.member_id, member_name: m.name,
      gender: m.gender || '', grade: m.grade || '',
      member_order: prev.length + 1, _isNew: true,
    }])
    setRosterEditSearch(''); setRosterEditResults([])
  }

  function handleRosterEditRemove(memberId) {
    setRosterEditMembers(prev => prev.filter(m => m.member_id !== memberId))
  }

  async function handleRosterEditSave() {
    if (!rosterEditPinVerified) { showToast('주장 PIN 인증이 필요합니다.', 'error'); return }
    if (rosterEditMembers.length === 0) { showToast('선수를 1명 이상 등록해주세요.', 'error'); return }
    setRosterEditSaving(true)
    const entryId = rosterEditTarget.id
    const { error: delErr } = await supabase.from('team_event_members').delete().eq('entry_id', entryId)
    if (delErr) { showToast('저장 실패: ' + delErr.message, 'error'); setRosterEditSaving(false); return }
    const { error: insErr } = await supabase.from('team_event_members').insert(
      rosterEditMembers.map((m, i) => ({
        entry_id: entryId, member_id: m.member_id || null,
        member_name: m.member_name, gender: m.gender || '',
        grade: m.grade || '', member_order: i + 1,
      }))
    )
    setRosterEditSaving(false)
    if (insErr) { showToast('저장 실패: ' + insErr.message, 'error'); return }
    showToast('✅ 선수 명단이 수정되었습니다.')
    closeRosterEdit()
    await fetchMyTeamEntries(phone.replace(/[^0-9]/g, ''), pin)
  }

  async function handleMySearch() {
    if (!phone.trim()) { setMyError('전화번호를 입력해주세요.'); return }
    if (pin.length !== 6) { setMyError('PIN 6자리를 입력해주세요.'); return }
    setMyError('')
    setMyLoading(true)
    setMySearched(false)

    const { data, error } = await supabase.rpc('rpc_get_my_entries', {
      p_phone: phone.replace(/[^0-9]/g, ''),
      p_pin: pin,
    })

    setMyLoading(false)
    setMySearched(true)

    if (error || !data?.ok) {
      setMyError(data?.message || error?.message || '조회 실패')
      setMyEntries([])
      setMyName('')
      return
    }

    setMyName(data.member_name || '')
    setMyEntries(data.entries || [])
    // 단체전 신청 내역도 함께 조회
    await fetchMyTeamEntries(phone.replace(/[^0-9]/g, ''), pin)
  }

  // ── 취소 가능 여부 판단 ──
  // 접수 마감 전이면 취소 가능 (미납·결제완료 모두)
  // 마감 후 또는 이미 취소/환불 상태면 불가
  function getCancelStatus(entry) {
    if (entry.entry_status === 'cancelled') return 'already'
    if (entry.payment_status === '환불대기') return 'refund_pending'
    if (entry.payment_status === '환불완료') return 'refund_done'
    // RPC 반환값에 entry_close_at 포함되어 있으므로 직접 사용
    if (entry.entry_close_at && new Date(entry.entry_close_at) < new Date()) return 'closed'
    return 'ok'
  }

  function openCancelModal(entry) {
    const status = getCancelStatus(entry)
    if (status === 'already')        { showToast('이미 취소된 신청입니다.', 'error'); return }
    if (status === 'refund_pending') { showToast('환불 신청 접수 중입니다.', 'error'); return }
    if (status === 'refund_done')    { showToast('이미 환불 완료된 건입니다.', 'error'); return }
    if (status === 'closed')         { showToast('접수 마감 후에는 취소할 수 없습니다.\n관리자에게 문의하세요.', 'error'); return }
    setRefundBank('')
    setRefundAccount('')
    setRefundHolder('')
    setCancelTarget(entry)
  }

  function closeCancelModal() {
    setCancelTarget(null)
    setRefundBank('')
    setRefundAccount('')
    setRefundHolder('')
  }

  const isPaid = cancelTarget?.payment_status === '결제완료'

  async function handleConfirmCancel() {
    if (!cancelTarget) return

    if (isPaid) {
      if (!refundBank.trim())    { showToast('은행명을 입력해주세요.', 'error'); return }
      if (!refundAccount.trim()) { showToast('계좌번호를 입력해주세요.', 'error'); return }
      if (!refundHolder.trim())  { showToast('예금주를 입력해주세요.', 'error'); return }
    }

    setCancelling(true)

    const updatePayload = {
      entry_status: '취소',
      cancelled_at: new Date().toISOString(),
    }

    if (isPaid) {
      updatePayload.payment_status      = '환불대기'
      updatePayload.refund_bank         = refundBank.trim()
      updatePayload.refund_account      = refundAccount.trim()
      updatePayload.refund_holder       = refundHolder.trim()
      updatePayload.refund_requested_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('event_entries')
      .update(updatePayload)
      .eq('entry_id', cancelTarget.entry_id)

    setCancelling(false)

    if (error) {
      showToast('취소 처리 실패: ' + error.message, 'error')
      return
    }

    showToast(isPaid ? '✅ 취소 및 환불 신청이 접수되었습니다.' : '✅ 신청이 취소되었습니다.')
    closeCancelModal()

    // 목록 낙관적 업데이트
    setMyEntries(prev => prev.map(e =>
      e.entry_id === cancelTarget.entry_id
        ? {
            ...e,
            entry_status:   'cancelled',
            payment_status: isPaid ? '환불대기' : e.payment_status,
          }
        : e
    ))
  }

  // ── 파트너 변경 ──
  function openPartnerModal(entry) {
    if (entry.entry_status === 'cancelled') { showToast('취소된 신청입니다.', 'error'); return }
    if (entry.entry_close_at && new Date(entry.entry_close_at) < new Date()) {
      showToast('접수 마감 후에는 변경할 수 없습니다.', 'error'); return
    }
    setPartnerSearch('')
    setPartnerResults([])
    setPartnerSelected(null)
    setPartnerTarget(entry)
  }

  function closePartnerModal() {
    setPartnerTarget(null)
    setPartnerSearch('')
    setPartnerResults([])
    setPartnerSelected(null)
  }

  async function handlePartnerSearch() {
    const q = partnerSearch.trim()
    if (!q) return
    setPartnerSearching(true)
    const { data } = await supabase
      .from('members')
      .select('member_id, name, club, status')
      .ilike('name', `%${q}%`)
      .eq('status', '활성')
      .limit(20)
    setPartnerSearching(false)

    // 같은 부서에 이미 신청한 member_id 수집 (프론트 체크)
    // entries는 전체현황 탭 데이터 (event_entries + teams join)
    const divisionEntries = entries.filter(e =>
      (e.event_divisions?.division_name || '') === (partnerTarget?.division_name || '') &&
      e.entry_id !== partnerTarget?.entry_id
    )
    const takenIds = new Set(
      divisionEntries.flatMap(e => [e.teams?.member1_id, e.teams?.member2_id].filter(Boolean))
    )
    // 본인(신청자) ID — RPC 반환값에 member1_id 직접 포함
    const selfId = partnerTarget?.member1_id

    const results = (data || []).map(m => ({
      ...m,
      disabled: takenIds.has(m.member_id) || m.member_id === selfId,
      disabledReason: takenIds.has(m.member_id) ? '이미 신청됨' : m.member_id === selfId ? '본인' : '',
    }))
    setPartnerResults(results)
  }

  async function handlePartnerSave() {
    if (!partnerTarget || !partnerSelected) return
    setPartnerSaving(true)

    // team_id: RPC 반환값에 있으면 직접 사용, 없으면 entry_id로 조회
    let teamId = partnerTarget.team_id
    if (!teamId) {
      const { data: entryData } = await supabase
        .from('event_entries')
        .select('team_id')
        .eq('entry_id', partnerTarget.entry_id)
        .single()
      teamId = entryData?.team_id
    }
    if (!teamId) { showToast('팀 정보를 찾을 수 없습니다.', 'error'); setPartnerSaving(false); return }

    const { error } = await supabase
      .from('teams')
      .update({ member2_id: partnerSelected.member_id })
      .eq('team_id', teamId)

    setPartnerSaving(false)
    if (error) { showToast('변경 실패: ' + error.message, 'error'); return }

    showToast('✅ 파트너가 변경되었습니다.')

    // 낙관적 업데이트 — myEntries에서 partner_name 갱신
    setMyEntries(prev => prev.map(e =>
      e.entry_id === partnerTarget.entry_id
        ? { ...e, partner_name: partnerSelected.name }
        : e
    ))
    closePartnerModal()
  }

  // ── 표시 헬퍼 ──
  const selectedEvent = events.find(e => e.event_id === selectedEventId)

  const divCounts = {}
  entries.forEach(e => {
    const d = e.event_divisions?.division_name || '기타'
    divCounts[d] = (divCounts[d] || 0) + 1
  })

  // 단체전 부서별 카운트
  const teamDivCounts = {}
  teamEntries.forEach(e => {
    const d = e.division_name || '미지정'
    teamDivCounts[d] = (teamDivCounts[d] || 0) + 1
  })

  const filteredEntries = activeDivision === '전체'
    ? entries
    : entries.filter(e => (e.event_divisions?.division_name || '기타') === activeDivision)

  const filteredTeamEntries = activeTeamDivision === '전체'
    ? teamEntries
    : teamEntries.filter(t => (t.division_name || '미지정') === activeTeamDivision)

  function formatDate(str) {
    if (!str) return ''
    return new Date(str).toLocaleDateString('ko-KR')
  }
  function formatCloseAt(eventId) {
    const ev = events.find(e => e.event_id === eventId)
    if (!ev?.entry_close_at) return null
    return formatDate(ev.entry_close_at)
  }

  function getStatusStyle(status) {
    if (status === 'confirmed') return 'bg-green-50 text-green-700'
    if (status === 'cancelled') return 'bg-gray-100 text-gray-500'
    return 'bg-yellow-50 text-yellow-700'
  }
  function getStatusLabel(status) {
    if (status === 'confirmed') return '확정'
    if (status === 'cancelled') return '취소'
    return '대기'
  }
  function getPayStyle(status) {
    if (status === '결제완료') return 'bg-green-50 text-green-700'
    if (status === '현장납부') return 'bg-yellow-50 text-yellow-700'
    if (status === '환불대기') return 'bg-orange-50 text-orange-700'
    if (status === '환불완료') return 'bg-gray-100 text-gray-500'
    return 'bg-red-50 text-red-600'
  }

  const sortedEventsForSelect = [...events].sort((a, b) => {
    const today = new Date().toISOString().slice(0, 10)
    const aFuture = a.event_date >= today
    const bFuture = b.event_date >= today
    if (aFuture && bFuture) return a.event_date.localeCompare(b.event_date)
    if (!aFuture && !bFuture) return b.event_date.localeCompare(a.event_date)
    return aFuture ? -1 : 1
  })

  return (
    <div className="pb-20">
      <PageHeader title="📝 신청확인" subtitle="대회 참가 신청 현황" />

      {/* ── 탭 ── */}
      <div className="max-w-lg mx-auto px-5 pt-4">
        <div className="flex gap-1 bg-soft rounded-xl p-1 mb-4">
          <button onClick={() => setTab('all')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors
              ${tab === 'all' ? 'bg-white text-accent shadow-sm' : 'text-sub'}`}>
            전체 현황
          </button>
          <button onClick={() => setTab('mine')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors
              ${tab === 'mine' ? 'bg-white text-accent shadow-sm' : 'text-sub'}`}>
            내 신청 내역
          </button>
        </div>
      </div>

      {/* ── 전체 현황 탭 ── */}
      {tab === 'all' && (
        <div className="max-w-lg mx-auto px-5">
          {events.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📝</p>
              <p className="text-sm text-sub">등록된 대회가 없습니다.</p>
            </div>
          ) : (
            <>
              <select value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5 mb-4 bg-white font-medium">
                {sortedEventsForSelect.map(ev => (
                  <option key={ev.event_id} value={ev.event_id}>
                    {ev.event_name} ({ev.event_date})
                  </option>
                ))}
              </select>

              {selectedEvent && (
                <div className="bg-soft rounded-lg p-3 mb-4">
                  <p className="text-sm font-semibold">{selectedEvent.event_name}</p>
                  <p className="text-xs text-sub mt-0.5">
                    📅 {selectedEvent.event_date}
                    {selectedEvent.entry_fee_team > 0 && ` · 💰 ${selectedEvent.entry_fee_team.toLocaleString()}원/팀`}
                    {selectedEvent.status === 'OPEN' ? ' · 🟢 접수중' : ' · 🔴 마감'}
                  </p>
                </div>
              )}

              {/* 개인전 부서 필터 */}
              {Object.keys(divCounts).length > 0 && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  <button onClick={() => setActiveDivision('전체')}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      activeDivision === '전체' ? 'bg-accent text-white' : 'bg-white border border-line hover:bg-soft'}`}>
                    <p className="text-[10px] opacity-80">전체</p>
                    <p className="text-lg font-bold">{entries.length}팀</p>
                  </button>
                  {Object.entries(divCounts).map(([div, count]) => (
                    <button key={div}
                      onClick={() => setActiveDivision(activeDivision === div ? '전체' : div)}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        activeDivision === div ? 'bg-accent text-white' : 'bg-white border border-line hover:bg-soft'}`}>
                      <p className={`text-[10px] ${activeDivision === div ? 'opacity-80' : 'text-sub'}`}>{div}</p>
                      <p className={`text-lg font-bold ${activeDivision === div ? '' : 'text-gray-800'}`}>{count}팀</p>
                    </button>
                  ))}
                </div>
              )}

              {loading ? (
                <p className="text-center py-8 text-sub text-sm">로딩 중...</p>
              ) : filteredEntries.length === 0 && filteredTeamEntries.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-sub">신청 내역이 없습니다.</p>
                </div>
              ) : (
                <>
                  {/* 개인전 목록 */}
                  {filteredEntries.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {filteredEntries.map((entry, idx) => (
                        <div key={entry.entry_id}
                          className="bg-white border border-line rounded-lg p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-sub w-6">{idx + 1}</span>
                            <div>
                              <p className="text-sm font-medium">
                                {entry._m1
                                  ? `${entry._m1.name}${entry._m1.club ? `(${entry._m1.club})` : ''}` +
                                    (entry._m2 ? `/${entry._m2.name}${entry._m2.club ? `(${entry._m2.club})` : ''}` : '')
                                  : (entry.teams?.team_name || '-')}
                              </p>
                              <p className="text-xs text-sub">
                                {entry.event_divisions?.division_name || '-'}
                                <span className="ml-2">
                                  {entry.applied_at ? new Date(entry.applied_at).toLocaleDateString('ko-KR') : ''}
                                </span>
                              </p>
                            </div>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${getPayStyle(entry.payment_status)}`}>
                            {entry.payment_status || '미납'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 단체전 팀 목록 (대기+확정) */}
                  {teamEntries.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">
                        👥 단체전 참가팀 ({teamEntries.length}팀)
                      </p>

                      {/* 단체전 부서 필터 */}
                      {Object.keys(teamDivCounts).length > 1 && (
                        <div className="flex gap-2 mb-3 flex-wrap">
                          <button onClick={() => setActiveTeamDivision('전체')}
                            className={`px-3 py-2 rounded-lg transition-colors ${
                              activeTeamDivision === '전체' ? 'bg-accent text-white' : 'bg-white border border-line hover:bg-soft'}`}>
                            <p className="text-[10px] opacity-80">전체</p>
                            <p className="text-lg font-bold">{teamEntries.length}팀</p>
                          </button>
                          {Object.entries(teamDivCounts).map(([div, count]) => (
                            <button key={div}
                              onClick={() => setActiveTeamDivision(activeTeamDivision === div ? '전체' : div)}
                              className={`px-3 py-2 rounded-lg transition-colors ${
                                activeTeamDivision === div ? 'bg-accent text-white' : 'bg-white border border-line hover:bg-soft'}`}>
                              <p className={`text-[10px] ${activeTeamDivision === div ? 'opacity-80' : 'text-sub'}`}>{div}</p>
                              <p className={`text-lg font-bold ${activeTeamDivision === div ? '' : 'text-gray-800'}`}>{count}팀</p>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        {filteredTeamEntries.map((team, idx) => (
                          <div key={team.id} className="bg-white border border-line rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-sm font-bold text-sub w-6 shrink-0">{idx + 1}</span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{team.club_name}</p>
                                  <p className="text-xs text-sub mt-0.5">
                                    {team.division_name || '부서 미지정'}
                                    {team.captain_name && <span className="ml-2">주장: {team.captain_name}</span>}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  team.status === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                                }`}>
                                  {team.status === 'confirmed' ? '확정' : '대기'}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${getPayStyle(team.payment_status)}`}>
                                  {team.payment_status || '미납'}
                                </span>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-line/40">
                              <button onClick={() => openRosterView(team)}
                                className="text-xs text-blue-500 border border-blue-200 bg-blue-50
                                  hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors">
                                선수 명단 보기
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 내 신청 내역 탭 ── */}
      {tab === 'mine' && (
        <div className="max-w-lg mx-auto px-5">
          <div className="bg-white border border-line rounded-xl p-4 mb-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">본인 확인</p>
            <div>
              <label className="block text-xs text-sub mb-1">전화번호</label>
              <input type="tel" value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">PIN (6자리)</label>
              <input type="password" inputMode="numeric" maxLength={6} value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="PIN 6자리"
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5 tracking-widest" />
              <p className="text-xs text-sub mt-1">PIN 초기값은 전화번호 뒷 6자리입니다.</p>
            </div>
            {myError && <p className="text-xs text-red-500">⚠️ {myError}</p>}
            <button onClick={handleMySearch} disabled={myLoading}
              className="w-full py-2.5 bg-accent text-white rounded-xl text-sm font-semibold
                hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {myLoading ? '조회 중...' : '🔍 내 신청 내역 조회'}
            </button>
          </div>

          {mySearched && !myError && (
            <div>
              {myName && (
                <p className="text-sm font-semibold text-gray-800 mb-3">
                  {myName}님의 신청 내역 (개인전 {myEntries.length}건 · 단체전 {myTeamEntries.length}건)
                </p>
              )}

              {myEntries.length === 0 && myTeamEntries.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-4xl mb-2">📭</p>
                  <p className="text-sm text-sub">신청 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">

                  {/* ── 개인전 내역 ── */}
                  {myEntries.map((e, idx) => {
                    const cancelStatus  = getCancelStatus(e)
                    const isCancelled   = e.entry_status === 'cancelled'
                    const closeDate     = e.entry_close_at ? formatDate(e.entry_close_at) : null
                    const showCancelBtn = !isCancelled
                      && e.payment_status !== '환불대기'
                      && e.payment_status !== '환불완료'
                    return (
                      <div key={e.entry_id || idx} className="bg-white border border-line rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{e.event_name}</p>
                            <p className="text-xs text-sub mt-0.5">📅 {e.event_date}</p>
                          </div>
                          <div className="flex flex-col gap-1 items-end shrink-0">
                            <span className={`text-[10px] px-2 py-0.5 rounded ${getStatusStyle(e.entry_status)}`}>
                              {getStatusLabel(e.entry_status)}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded ${getPayStyle(e.payment_status)}`}>
                              {e.payment_status || '미납'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-3 text-xs text-sub mb-1">
                          {e.division_name && <span>📋 {e.division_name}</span>}
                          {e.partner_name  && <span>🤝 파트너: {e.partner_name}</span>}
                        </div>
                        <p className="text-[10px] text-gray-400 mb-2">신청일: {formatDate(e.applied_at)}</p>
                        {e.payment_status === '환불대기' && (
                          <div className="bg-orange-50 rounded-lg px-3 py-2 mt-1">
                            <p className="text-[10px] text-orange-700">환불 신청 접수 완료. 관리자 확인 후 입금됩니다.</p>
                          </div>
                        )}
                        {e.payment_status === '환불완료' && (
                          <p className="text-[10px] text-gray-400 mt-1">환불 처리가 완료되었습니다.</p>
                        )}
                        {showCancelBtn && (
                          <div className="border-t border-line mt-3 pt-3 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-sub">
                              {cancelStatus === 'closed'
                                ? '🔴 마감 후 취소불가 · 관리자 문의'
                                : closeDate ? `마감: ${closeDate}` : ''}
                            </span>
                            <div className="flex gap-1.5 shrink-0">
                              {cancelStatus === 'ok' && (
                                <button onClick={() => openPartnerModal(e)}
                                  className="text-xs text-blue-500 border border-blue-200 bg-blue-50
                                    hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors">
                                  파트너 변경
                                </button>
                              )}
                              {cancelStatus === 'ok' ? (
                                <button onClick={() => openCancelModal(e)}
                                  className="text-xs text-red-500 border border-red-200 bg-red-50
                                    hover:bg-red-100 rounded-lg px-3 py-1.5 transition-colors">
                                  신청 취소
                                </button>
                              ) : cancelStatus !== 'already' && cancelStatus !== 'refund_pending' && cancelStatus !== 'refund_done' ? (
                                <span className="text-[10px] text-gray-400 border border-gray-200
                                  bg-gray-50 rounded-lg px-3 py-1.5">
                                  취소불가
                                </span>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* ── 단체전 내역 ── */}
                  {myTeamEntries.length > 0 && (
                    <>
                      {myEntries.length > 0 && (
                        <p className="text-xs font-semibold text-gray-500 pt-1">👥 단체전</p>
                      )}
                      {myTeamEntries.map((t, idx) => {
                        const evName  = t.events?.event_name || '-'
                        const evDate  = t.events?.event_date || '-'
                        const closeAt = t.events?.entry_close_at
                        const canEdit = !closeAt || new Date(closeAt) > new Date()
                        return (
                          <div key={t.id || idx} className="bg-white border border-line rounded-xl p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <p className="text-sm font-bold text-gray-900">{evName}</p>
                                <p className="text-xs text-sub mt-0.5">📅 {evDate}</p>
                              </div>
                              <div className="flex flex-col gap-1 items-end shrink-0">
                                <span className={`text-[10px] px-2 py-0.5 rounded ${
                                  t.status === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                                }`}>
                                  {t.status === 'confirmed' ? '확정' : '대기'}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded ${getPayStyle(t.payment_status)}`}>
                                  {t.payment_status || '미납'}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-3 text-xs text-sub mb-1">
                              {t.division_name && <span>📋 {t.division_name}</span>}
                              <span>🏅 {t.club_name}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mb-2">신청일: {formatDate(t.created_at)}</p>
                            <div className="border-t border-line pt-2 mt-2 flex gap-2">
                              <button onClick={() => openRosterView(t)}
                                className="text-xs text-blue-500 border border-blue-200 bg-blue-50
                                  hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors">
                                선수 명단 보기
                              </button>
                              {canEdit && (
                                <button onClick={() => openRosterEdit(t)}
                                  className="text-xs text-gray-600 border border-gray-200 bg-gray-50
                                    hover:bg-gray-100 rounded-lg px-3 py-1.5 transition-colors">
                                  명단 수정
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 선수 명단 보기 모달 ── */}
      {rosterViewTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="absolute inset-0 bg-black/40" onClick={closeRosterView} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl px-5 pt-4 pb-8 z-10 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{rosterViewTarget.club_name}</h3>
                <p className="text-xs text-sub mt-0.5">
                  {rosterViewTarget.division_name || '부서 미지정'} · 주장: {rosterViewTarget.captain_name}
                </p>
              </div>
              <button onClick={closeRosterView} className="text-sub text-lg leading-none">✕</button>
            </div>
            {rosterViewLoading ? (
              <p className="text-center py-6 text-sm text-sub">로딩 중...</p>
            ) : rosterViewMembers.length === 0 ? (
              <p className="text-center py-6 text-sm text-sub">선수 명단이 없습니다.</p>
            ) : (
              <div className="border border-line rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-soft text-xs text-sub">
                    <tr>
                      <th className="text-left px-3 py-2 w-8">#</th>
                      <th className="text-left px-3 py-2">이름</th>
                      <th className="text-left px-3 py-2 w-12">성별</th>
                      <th className="text-left px-3 py-2 w-16">등급</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterViewMembers.map((m, i) => (
                      <tr key={m.id || i} className="border-t border-line/30">
                        <td className="px-3 py-2.5 text-xs text-sub">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium">{m.member_name}</td>
                        <td className="px-3 py-2.5 text-xs">{m.gender === 'M' || m.gender === '남' ? '남' : m.gender === 'F' || m.gender === '여' ? '여' : '-'}</td>
                        <td className="px-3 py-2.5 text-xs text-accent">{m.grade || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button onClick={closeRosterView}
              className="w-full mt-4 py-3 border border-line rounded-xl text-sm text-sub hover:bg-soft transition-colors">
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ── 선수 명단 수정 모달 ── */}
      {rosterEditTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="absolute inset-0 bg-black/40" onClick={closeRosterEdit} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl px-5 pt-4 pb-8 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">선수 명단 수정</h3>
                <p className="text-xs text-sub mt-0.5">
                  {rosterEditTarget.club_name} · {rosterEditTarget.division_name || '부서 미지정'}
                </p>
              </div>
              <button onClick={closeRosterEdit} className="text-sub text-lg leading-none">✕</button>
            </div>

            {!rosterEditPinVerified ? (
              /* STEP 1: 주장 PIN 인증 */
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-800">
                    명단 수정은 주장({rosterEditTarget.captain_name}) 본인만 가능합니다.
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-sub mb-1">주장 PIN (6자리)</label>
                  <input type="password" inputMode="numeric" maxLength={6}
                    value={rosterEditPin}
                    onChange={e => setRosterEditPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="PIN 6자리"
                    className="w-full text-sm border border-line rounded-lg px-3 py-2.5 tracking-widest" />
                </div>
                <div className="flex gap-3">
                  <button onClick={closeRosterEdit}
                    className="flex-1 py-3 border border-line rounded-xl text-sm text-sub hover:bg-soft transition-colors">
                    취소
                  </button>
                  <button onClick={handleRosterEditPinVerify}
                    disabled={rosterEditPinLoading || rosterEditPin.length !== 6}
                    className="flex-1 py-3 bg-accent text-white rounded-xl text-sm font-semibold
                      hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {rosterEditPinLoading ? '확인 중...' : '인증'}
                  </button>
                </div>
              </div>
            ) : (
              /* STEP 2: 명단 편집 */
              <div className="space-y-4">
                {rosterEditLoading ? (
                  <p className="text-center py-4 text-sm text-sub">로딩 중...</p>
                ) : (
                  <div className="border border-line rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-soft flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-700">
                        선수 명단 ({rosterEditMembers.length}명)
                      </span>
                    </div>
                    {rosterEditMembers.length === 0 ? (
                      <p className="text-center py-4 text-sm text-sub">명단이 비어있습니다.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-sub">
                          <tr>
                            <th className="text-left px-3 py-2 w-8">#</th>
                            <th className="text-left px-3 py-2">이름</th>
                            <th className="text-left px-3 py-2 w-12">성별</th>
                            <th className="text-left px-3 py-2 w-16">등급</th>
                            <th className="text-center px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {rosterEditMembers.map((m, i) => (
                            <tr key={m.member_id || i} className="border-t border-line/30">
                              <td className="px-3 py-2 text-xs text-sub">{i + 1}</td>
                              <td className="px-3 py-2 font-medium">{m.member_name}</td>
                              <td className="px-3 py-2 text-xs">{m.gender === 'M' || m.gender === '남' ? '남' : m.gender === 'F' || m.gender === '여' ? '여' : '-'}</td>
                              <td className="px-3 py-2 text-xs text-accent">{m.grade || '-'}</td>
                              <td className="px-3 py-2 text-center">
                                <button onClick={() => handleRosterEditRemove(m.member_id)}
                                  className="text-red-400 hover:text-red-600 text-sm">✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">선수 추가</p>
                  <div className="flex gap-2">
                    <input type="text" value={rosterEditSearch}
                      onChange={e => setRosterEditSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRosterEditSearch()}
                      placeholder="이름 검색"
                      className="flex-1 text-sm border border-line rounded-lg px-3 py-2.5" />
                    <button onClick={handleRosterEditSearch}
                      disabled={rosterEditSearching || !rosterEditSearch.trim()}
                      className="px-4 py-2.5 bg-accent text-white text-sm rounded-lg disabled:opacity-50 whitespace-nowrap">
                      {rosterEditSearching ? '검색 중' : '검색'}
                    </button>
                  </div>
                  {rosterEditResults.length > 0 && (
                    <div className="border border-line rounded-xl overflow-hidden mt-2 max-h-44 overflow-y-auto">
                      {rosterEditResults.map(m => (
                        <button key={m.member_id}
                          disabled={m.disabled}
                          onClick={() => !m.disabled && handleRosterEditAdd(m)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-left
                            border-b border-line last:border-0 transition-colors
                            ${m.disabled ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'hover:bg-soft'}`}>
                          <div>
                            <span className="text-sm font-medium">{m.name}</span>
                            {m.club && <span className="text-xs text-sub ml-1.5">({m.club})</span>}
                            {m.grade && <span className="text-xs text-sub ml-1.5">{m.grade}</span>}
                          </div>
                          {m.disabled
                            ? <span className="text-[10px] text-gray-400">{m.disabledReason}</span>
                            : <span className="text-xs text-accent">+ 추가</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={closeRosterEdit}
                    className="flex-1 py-3 border border-line rounded-xl text-sm text-sub hover:bg-soft transition-colors">
                    취소
                  </button>
                  <button onClick={handleRosterEditSave}
                    disabled={rosterEditSaving || rosterEditMembers.length === 0}
                    className="flex-1 py-3 bg-accent text-white rounded-xl text-sm font-semibold
                      hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {rosterEditSaving ? '저장 중...' : '명단 저장'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 취소 확인 모달 ── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="absolute inset-0 bg-black/40" onClick={closeCancelModal} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl px-5 pt-4 pb-8 z-10">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {isPaid ? '신청 취소 및 환불 신청' : '신청 취소 확인'}
            </h3>
            <p className="text-xs text-sub mb-4">취소 후에는 되돌릴 수 없습니다.</p>
            <div className="bg-soft rounded-xl px-4 py-3 mb-4">
              <p className="text-sm font-semibold text-gray-900">{cancelTarget.event_name}</p>
              <p className="text-xs text-sub mt-0.5">
                {[cancelTarget.division_name, cancelTarget.payment_status || '미납'].filter(Boolean).join(' · ')}
              </p>
            </div>
            {isPaid && (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    결제 완료 건입니다. 환불받을 계좌를 입력해 주세요. 관리자 확인 후 입금 처리됩니다.
                  </p>
                </div>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs text-sub mb-1">은행명</label>
                    <input type="text" value={refundBank}
                      onChange={e => setRefundBank(e.target.value)}
                      placeholder="예) 농협, 국민, 카카오뱅크"
                      className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
                  </div>
                  <div>
                    <label className="block text-xs text-sub mb-1">계좌번호</label>
                    <input type="text" inputMode="numeric" value={refundAccount}
                      onChange={e => setRefundAccount(e.target.value.replace(/[^0-9-]/g, ''))}
                      placeholder="숫자만 입력"
                      className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
                  </div>
                  <div>
                    <label className="block text-xs text-sub mb-1">예금주</label>
                    <input type="text" value={refundHolder}
                      onChange={e => setRefundHolder(e.target.value)}
                      placeholder="예금주 이름"
                      className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
                  </div>
                </div>
              </>
            )}
            <div className="flex gap-3">
              <button onClick={closeCancelModal}
                className="flex-1 py-3 border border-line rounded-xl text-sm text-sub hover:bg-soft transition-colors">
                닫기
              </button>
              <button onClick={handleConfirmCancel} disabled={cancelling}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold
                  hover:bg-red-600 disabled:opacity-50 transition-colors">
                {cancelling ? '처리 중...' : isPaid ? '취소 및 환불신청' : '신청 취소'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 파트너 변경 모달 ── */}
      {partnerTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="absolute inset-0 bg-black/40" onClick={closePartnerModal} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl px-5 pt-4 pb-8 z-10">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">파트너 변경</h3>
            <div className="bg-soft rounded-xl px-4 py-3 mb-4">
              <p className="text-xs text-sub mb-0.5">현재 파트너</p>
              <p className="text-sm font-semibold text-gray-900">{partnerTarget.partner_name || '(없음)'}</p>
              <p className="text-xs text-sub mt-0.5">{partnerTarget.division_name} · {partnerTarget.event_name}</p>
            </div>
            <div className="flex gap-2 mb-3">
              <input type="text" value={partnerSearch}
                onChange={e => setPartnerSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePartnerSearch()}
                placeholder="회원 이름 검색"
                className="flex-1 text-sm border border-line rounded-lg px-3 py-2.5" />
              <button onClick={handlePartnerSearch}
                disabled={partnerSearching || !partnerSearch.trim()}
                className="px-4 py-2.5 bg-accent text-white text-sm rounded-lg disabled:opacity-50 whitespace-nowrap">
                {partnerSearching ? '검색 중' : '검색'}
              </button>
            </div>
            {partnerResults.length > 0 && (
              <div className="border border-line rounded-xl overflow-hidden mb-4 max-h-48 overflow-y-auto">
                {partnerResults.map(m => (
                  <button key={m.member_id}
                    disabled={m.disabled}
                    onClick={() => !m.disabled && setPartnerSelected(m)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left
                      border-b border-line last:border-0 transition-colors
                      ${partnerSelected?.member_id === m.member_id
                        ? 'bg-blue-50'
                        : m.disabled ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'hover:bg-soft'
                      }`}>
                    <div>
                      <span className="text-sm font-medium">{m.name}</span>
                      {m.club && <span className="text-xs text-sub ml-1.5">({m.club})</span>}
                    </div>
                    {m.disabled
                      ? <span className="text-[10px] text-gray-400">{m.disabledReason}</span>
                      : partnerSelected?.member_id === m.member_id
                        ? <span className="text-xs text-blue-500 font-medium">✓ 선택됨</span>
                        : null}
                  </button>
                ))}
              </div>
            )}
            {partnerSelected && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-4">
                <p className="text-xs text-blue-600 mb-0.5">새 파트너</p>
                <p className="text-sm font-semibold text-blue-800">
                  {partnerSelected.name}
                  {partnerSelected.club && <span className="font-normal text-blue-600 ml-1">({partnerSelected.club})</span>}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={closePartnerModal}
                className="flex-1 py-3 border border-line rounded-xl text-sm text-sub hover:bg-soft transition-colors">
                닫기
              </button>
              <button onClick={handlePartnerSave}
                disabled={!partnerSelected || partnerSaving}
                className="flex-1 py-3 bg-accent text-white rounded-xl text-sm font-semibold
                  hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {partnerSaving ? '저장 중...' : '변경 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
