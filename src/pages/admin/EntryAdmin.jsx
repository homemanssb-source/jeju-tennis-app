// src/pages/admin/EntryAdmin.jsx
import { useState, useEffect, useContext, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function EntryAdmin() {
  const showToast = useContext(ToastContext)
  const [events, setEvents]           = useState([])
  const [entries, setEntries]         = useState([])       // 개인전
  const [teamEntries, setTeamEntries] = useState([])       // 단체전
  const [selectedEventId, setSelectedEventId] = useState('')
  const [filterPayment, setFilterPayment]     = useState('')
  const [filterType, setFilterType]           = useState('')
  const [filterName, setFilterName]           = useState('')  // ★ 이름 검색
  const [loading, setLoading]                 = useState(false)

  // ── 취소 확인 모달 (관리자) ──
  const [confirmModal, setConfirmModal] = useState(null) // { message, onConfirm }

  // ── 환불 처리 모달 ──
  const [refundModal, setRefundModal] = useState(null) // entry 객체 (_raw 포함)
  const [refunding, setRefunding]     = useState(false)

  // ── 선수 변경 모달 ──
  const [editModal, setEditModal]           = useState(null)   // entry 객체
  const [editField, setEditField]           = useState(null)   // 'member1' | 'member2'
  const [editSearch, setEditSearch]         = useState('')
  const [editResults, setEditResults]       = useState([])
  const [editSelected, setEditSelected]     = useState(null)   // { member_id, name, club }
  const [editSearching, setEditSearching]   = useState(false)
  const [editSaving, setEditSaving]         = useState(false)

  // ── 단체전 명단 수정 모달 ──
  const [teamEditModal, setTeamEditModal]         = useState(null)  // team entry _raw
  const [teamEditMembers, setTeamEditMembers]     = useState([])    // [{ member_id, member_name, gender, grade }]
  const [teamEditSearch, setTeamEditSearch]       = useState('')
  const [teamEditResults, setTeamEditResults]     = useState([])
  const [teamEditSearching, setTeamEditSearching] = useState(false)
  const [teamEditSaving, setTeamEditSaving]       = useState(false)
  const teTimer = useRef(null)

  // ── 관리자 직접 등록 모달 ──
  const [addModal, setAddModal]           = useState(false)
  const [addTab, setAddTab]               = useState('individual') // 'individual' | 'team'
  const [addSubmitting, setAddSubmitting] = useState(false)

  // 개인전 직접 등록 state
  const [addDivisions, setAddDivisions]       = useState([])
  const [addDivisionId, setAddDivisionId]     = useState('')
  const [addM1Search, setAddM1Search]         = useState('')
  const [addM1Results, setAddM1Results]       = useState([])
  const [addM1Selected, setAddM1Selected]     = useState(null)
  const [addM1Searching, setAddM1Searching]   = useState(false)
  const [addM2Search, setAddM2Search]         = useState('')
  const [addM2Results, setAddM2Results]       = useState([])
  const [addM2Selected, setAddM2Selected]     = useState(null)
  const [addM2Searching, setAddM2Searching]   = useState(false)

  // 단체전 직접 등록 state
  const [addClubName, setAddClubName]         = useState('')
  const [addCaptainName, setAddCaptainName]   = useState('')
  const [addTeamDivision, setAddTeamDivision] = useState('')
  const [addTeamMembers, setAddTeamMembers]   = useState([]) // [{ member_id, name, club, gender, grade }]
  const [addTmSearch, setAddTmSearch]         = useState('')
  const [addTmResults, setAddTmResults]       = useState([])
  const [addTmSearching, setAddTmSearching]   = useState(false)

  const m1Timer = useRef(null)
  const m2Timer = useRef(null)
  const tmTimer = useRef(null)

  useEffect(() => { fetchEvents() }, [])
  useEffect(() => {
    if (selectedEventId) { fetchEntries(); fetchTeamEntries() }
  }, [selectedEventId])

  async function fetchEvents() {
    const { data } = await supabase.from('events')
      .select('*').order('event_date', { ascending: false })
    setEvents(data || [])
  }

  async function fetchEntries() {
    setLoading(true)
    // 일반 신청 건 (취소 제외)
    const { data: normalData } = await supabase
      .from('event_entries')
      .select('*, teams ( team_id, team_name, member1_id, member2_id ), event_divisions ( division_name )')
      .eq('event_id', selectedEventId)
      .neq('entry_status', '취소')
      .order('applied_at', { ascending: false })

    // 환불대기/환불완료 건 (취소됐지만 관리자가 처리해야 할 건)
    const { data: refundData } = await supabase
      .from('event_entries')
      .select('*, teams ( team_id, team_name, member1_id, member2_id ), event_divisions ( division_name )')
      .eq('event_id', selectedEventId)
      .eq('entry_status', '취소')
      .in('payment_status', ['환불대기', '환불완료'])
      .order('applied_at', { ascending: false })

    const merged = [
      ...(normalData || []),
      ...(refundData || []),
    ]

    // ★ member_id 목록 수집 → members 테이블에서 club 한번에 조회
    const memberIds = [...new Set(
      merged.flatMap(e => [e.teams?.member1_id, e.teams?.member2_id].filter(Boolean))
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
    for (const e of merged) {
      e._m1 = e.teams?.member1_id ? memberClubMap[e.teams.member1_id] : null
      e._m2 = e.teams?.member2_id ? memberClubMap[e.teams.member2_id] : null
    }

    setEntries(merged)
    setLoading(false)
  }

  async function fetchTeamEntries() {
    const { data } = await supabase
      .from('team_event_entries')
      .select('*')
      .eq('event_id', selectedEventId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })

    const rows = data || []

    // team_event_members에서 gender 조회
    const entryIds = rows.map(e => e.id)
    let membersMap = {} // entry_id → [{ gender }]
    if (entryIds.length > 0) {
      const { data: membersData } = await supabase
        .from('team_event_members')
        .select('entry_id, member_id, member_name, gender')
        .in('entry_id', entryIds)
      for (const m of (membersData || [])) {
        if (!membersMap[m.entry_id]) membersMap[m.entry_id] = []
        membersMap[m.entry_id].push(m)
      }
    }

    // 각 entry에 _members 첨부
    for (const e of rows) {
      e._members = membersMap[e.id] || []
    }

    setTeamEntries(rows)
  }

  // ── 통합 목록 ──
  const allEntries = [
    ...entries.map(e => {
      // ★ "홍길동(제주하나)/홍길금(제주아라)" 형식 조합
      const p1 = e._m1 ? (e._m1.club ? `${e._m1.name}(${e._m1.club})` : e._m1.name) : ''
      const p2 = e._m2 ? (e._m2.club ? `${e._m2.name}(${e._m2.club})` : e._m2.name) : ''
      const displayName = p1 && p2 ? `${p1}/${p2}` : (p1 || e.teams?.team_name || '-')
      return {
        id:             e.entry_id,
        type:           '개인',
        name:           displayName,
        division:       e.event_divisions?.division_name || '-',
        status:         e.entry_status,
        payment_status: e.payment_status,
        date:           e.applied_at,
        _source:        'individual',
        _raw:           e,
      }
    }),
    ...teamEntries.map(e => {
      // team_event_members의 gender로 남/여 집계
      const members = e._members || []
      const maleCount   = members.filter(m => m.gender === 'M' || m.gender === '남').length
      const femaleCount = members.filter(m => m.gender === 'F' || m.gender === '여').length
      const genderLabel = members.length === 0 ? '-'
        : femaleCount === 0 ? `남 ${maleCount}`
        : maleCount === 0   ? `여 ${femaleCount}`
        : `남${maleCount}/여${femaleCount}`
      return {
        id:             e.id,
        type:           '단체',
        name:           e.club_name || '-',
        division:       e.division_name || '-',
        status:         e.status === 'confirmed' ? '확정' : e.status === 'pending' ? '대기' : e.status,
        payment_status: e.payment_status || '미납',
        date:           e.created_at,
        gender:         genderLabel,
        _source:        'team',
        _raw:           e,
      }
    }),
  ]

  // 취소 건 제외한 카운트 기준 목록
  const activeEntries = allEntries.filter(e =>
    e.status !== '취소' && e.payment_status !== '환불완료'
  )

  const totalCount   = activeEntries.length
  const paidCount    = activeEntries.filter(e => e.payment_status === '결제완료').length
  const unpaidCount  = activeEntries.filter(e => e.payment_status === '미납').length
  const refundCount  = allEntries.filter(e => e.payment_status === '환불대기').length

  // ★ 필터 적용 (이름 검색 포함)
  const filtered = allEntries.filter(e => {
    if (filterPayment && e.payment_status !== filterPayment) return false
    if (filterType === '개인' && e.type !== '개인') return false
    if (filterType === '단체' && e.type !== '단체') return false
    if (filterName.trim() && !e.name.toLowerCase().includes(filterName.trim().toLowerCase())) return false
    return true
  })

  // ── 결제 상태 변경 ──
  async function handlePaymentSet(entry, status) {
    if (entry._source === 'individual') {
      await supabase.from('event_entries')
        .update({ payment_status: status, paid_at: status === '결제완료' ? new Date().toISOString() : null })
        .eq('entry_id', entry.id)
    } else {
      await supabase.from('team_event_entries')
        .update({ payment_status: status, paid_at: status === '결제완료' ? new Date().toISOString() : null })
        .eq('id', entry.id)
    }
    showToast?.('결제 상태 변경: ' + status)
    fetchEntries(); fetchTeamEntries()
  }

  // ── 신청 취소 (관리자) ──
  function handleCancelConfirm(entry) {
    setConfirmModal({
      message: `"${entry.name}" 신청을 취소하시겠습니까?` +
        (entry._source === 'team' ? '\n(해당 팀의 대회결과도 함께 삭제됩니다)' : ''),
      onConfirm: async () => {
        if (entry._source === 'individual') {
          await supabase.from('event_entries')
            .update({ entry_status: '취소', cancelled_at: new Date().toISOString() })
            .eq('entry_id', entry.id)
        } else {
          // 팀 정보 + 대회명 먼저 확보 (tournament_results 삭제용)
          const { data: team } = await supabase
            .from('team_event_entries')
            .select('id, club_name, division_name, event_id')
            .eq('id', entry.id)
            .single()
          let tournamentName = null
          let memberIds = []
          if (team) {
            const [{ data: ev }, { data: tmembers }] = await Promise.all([
              supabase.from('events').select('event_name').eq('event_id', team.event_id).single(),
              supabase.from('team_event_members').select('member_id').eq('entry_id', team.id),
            ])
            tournamentName = ev?.event_name || null
            memberIds = (tmembers || []).map(m => m.member_id).filter(Boolean)
          }

          await supabase.from('team_event_entries')
            .update({ status: 'cancelled' })
            .eq('id', entry.id)

          // tournament_results 자동 정리: club_name 매치 우선, 안 되면 member_ids로 fallback
          if (team && tournamentName) {
            await supabase.from('tournament_results')
              .delete()
              .eq('tournament_name', tournamentName)
              .eq('division', team.division_name || '')
              .eq('club_name', team.club_name)
            if (memberIds.length > 0) {
              // club_name이 NULL인 과거 행도 member + 부서 + 대회 기준으로 추가 정리
              await supabase.from('tournament_results')
                .delete()
                .eq('tournament_name', tournamentName)
                .eq('division', team.division_name || '')
                .is('club_name', null)
                .in('member_id', memberIds)
            }
          }
        }
        showToast?.('신청 취소됨')
        setConfirmModal(null)
        fetchEntries(); fetchTeamEntries()
      }
    })
  }

  // ── 환불 완료 처리 ──
  async function handleRefundComplete() {
    if (!refundModal) return
    setRefunding(true)
    const { error } = await supabase.from('event_entries')
      .update({
        payment_status:      '환불완료',
        refund_completed_at: new Date().toISOString(),
      })
      .eq('entry_id', refundModal.id)

    setRefunding(false)
    if (error) { showToast?.('환불 처리 실패: ' + error.message, 'error'); return }
    showToast?.('✅ 환불 완료 처리되었습니다.')
    setRefundModal(null)
    fetchEntries()
  }

  // ── 선수 변경 (관리자) ──
  function openEditModal(entry, field) {
    setEditModal(entry)
    setEditField(field)
    setEditSearch('')
    setEditResults([])
    setEditSelected(null)
  }

  function closeEditModal() {
    setEditModal(null)
    setEditField(null)
    setEditSearch('')
    setEditResults([])
    setEditSelected(null)
  }

  async function handleEditSearch() {
    const q = editSearch.trim()
    if (!q) return
    setEditSearching(true)
    const { data } = await supabase
      .from('members')
      .select('member_id, name, club, status')
      .ilike('name', `%${q}%`)
      .eq('status', '활성')
      .limit(20)
    setEditSearching(false)

    const raw = editModal?._raw
    const divisionName = editModal?.division

    // 같은 부서 기신청자 수집 (프론트 체크)
    const divisionEntries = entries.filter(e =>
      (e.event_divisions?.division_name || '') === divisionName &&
      e.entry_id !== raw?.entry_id
    )
    const takenIds = new Set(
      divisionEntries.flatMap(e => [e.teams?.member1_id, e.teams?.member2_id].filter(Boolean))
    )
    // 변경 대상이 아닌 쪽 member_id (같은 팀 내 다른 선수)
    const sameTeamId = editField === 'member1'
      ? raw?.teams?.member2_id
      : raw?.teams?.member1_id

    const results = (data || []).map(m => ({
      ...m,
      disabled: (takenIds.has(m.member_id) && m.member_id !== (editField === 'member1' ? raw?.teams?.member1_id : raw?.teams?.member2_id))
                || m.member_id === sameTeamId,
      disabledReason: m.member_id === sameTeamId ? '같은 팀' : takenIds.has(m.member_id) ? '이미 신청됨' : '',
    }))
    setEditResults(results)
  }

  async function handleEditSave() {
    if (!editModal || !editSelected || !editField) return
    setEditSaving(true)

    const teamId = editModal._raw?.teams?.team_id
    const updateData = editField === 'member1'
      ? { member1_id: editSelected.member_id }
      : { member2_id: editSelected.member_id }

    const { error } = await supabase
      .from('teams')
      .update(updateData)
      .eq('team_id', teamId)

    setEditSaving(false)
    if (error) { showToast?.('변경 실패: ' + error.message, 'error'); return }

    showToast?.('✅ 선수가 변경되었습니다.')
    closeEditModal()
    fetchEntries()
  }

  // ── 단체전 명단 수정 (관리자) ──
  async function openTeamEditModal(teamEntry) {
    setTeamEditModal(teamEntry)
    setTeamEditSearch('')
    setTeamEditResults([])
    const { data } = await supabase
      .from('team_event_members')
      .select('member_id, member_name, gender, grade')
      .eq('entry_id', teamEntry.id)
      .order('member_order')
    setTeamEditMembers(data || [])
  }

  function closeTeamEditModal() {
    setTeamEditModal(null)
    setTeamEditMembers([])
    setTeamEditSearch('')
    setTeamEditResults([])
  }

  function handleTeamEditSearchChange(val) {
    setTeamEditSearch(val)
    if (teTimer.current) clearTimeout(teTimer.current)
    if (!val.trim()) { setTeamEditResults([]); return }
    teTimer.current = setTimeout(async () => {
      setTeamEditSearching(true)
      const { data } = await supabase
        .from('members')
        .select('member_id, name, club, gender, grade, status')
        .ilike('name', `%${val.trim()}%`)
        .eq('status', '활성')
        .limit(15)
      setTeamEditSearching(false)
      setTeamEditResults(data || [])
    }, 350)
  }

  function handleTeamEditAdd(m) {
    if (teamEditMembers.find(x => x.member_id === m.member_id)) return
    setTeamEditMembers(prev => [...prev, {
      member_id: m.member_id, member_name: m.name,
      gender: m.gender || '', grade: m.grade || '',
      _club: m.club,
    }])
    setTeamEditSearch('')
    setTeamEditResults([])
  }

  function handleTeamEditRemove(id) {
    setTeamEditMembers(prev => prev.filter(x => x.member_id !== id))
  }

  async function handleTeamEditSave() {
    if (!teamEditModal) return
    if (teamEditMembers.length === 0) { showToast?.('선수를 1명 이상 등록해주세요.', 'error'); return }
    setTeamEditSaving(true)
    const entryId = teamEditModal.id
    const { error: delErr } = await supabase
      .from('team_event_members').delete().eq('entry_id', entryId)
    if (delErr) {
      setTeamEditSaving(false)
      showToast?.('저장 실패: ' + delErr.message, 'error'); return
    }
    const { error: insErr } = await supabase
      .from('team_event_members')
      .insert(teamEditMembers.map((m, i) => ({
        entry_id:     entryId,
        member_id:    m.member_id || null,
        member_name:  m.member_name,
        gender:       m.gender || '',
        grade:        m.grade || '',
        member_order: i + 1,
      })))
    setTeamEditSaving(false)
    if (insErr) { showToast?.('저장 실패: ' + insErr.message, 'error'); return }
    showToast?.('✅ 선수명단이 수정되었습니다.')
    closeTeamEditModal()
    fetchTeamEntries()
  }

  // ── 직접 등록 모달 열기/닫기 ──
  async function openAddModal() {
    setAddModal(true)
    setAddTab('individual')
    setAddDivisionId('')
    setAddM1Search(''); setAddM1Results([]); setAddM1Selected(null)
    setAddM2Search(''); setAddM2Results([]); setAddM2Selected(null)
    setAddClubName(''); setAddCaptainName(''); setAddTeamDivision('')
    setAddTeamMembers([]); setAddTmSearch(''); setAddTmResults([])

    // 현재 선택된 대회의 부서 목록 로드
    if (selectedEventId) {
      const { data } = await supabase
        .from('event_divisions')
        .select('division_id, division_name')
        .eq('event_id', selectedEventId)
        .order('division_name')
      setAddDivisions(data || [])
    }
  }

  function closeAddModal() {
    setAddModal(false)
  }

  // ── 개인전: 선수 검색 (debounce) ──
  function handleM1SearchChange(val) {
    setAddM1Search(val)
    setAddM1Selected(null)
    if (m1Timer.current) clearTimeout(m1Timer.current)
    if (!val.trim()) { setAddM1Results([]); return }
    m1Timer.current = setTimeout(() => searchMemberFor('m1', val), 350)
  }
  function handleM2SearchChange(val) {
    setAddM2Search(val)
    setAddM2Selected(null)
    if (m2Timer.current) clearTimeout(m2Timer.current)
    if (!val.trim()) { setAddM2Results([]); return }
    m2Timer.current = setTimeout(() => searchMemberFor('m2', val), 350)
  }

  async function searchMemberFor(target, q) {
    const setSearching = target === 'm1' ? setAddM1Searching : setAddM2Searching
    const setResults   = target === 'm1' ? setAddM1Results   : setAddM2Results
    setSearching(true)
    const { data } = await supabase
      .from('members')
      .select('member_id, name, club, status')
      .ilike('name', `%${q.trim()}%`)
      .eq('status', '활성')
      .limit(15)
    setSearching(false)
    setResults(data || [])
  }

  // ── 단체전: 선수 검색 ──
  function handleTmSearchChange(val) {
    setAddTmSearch(val)
    if (tmTimer.current) clearTimeout(tmTimer.current)
    if (!val.trim()) { setAddTmResults([]); return }
    tmTimer.current = setTimeout(async () => {
      setAddTmSearching(true)
      const { data } = await supabase
        .from('members')
        .select('member_id, name, club, gender, grade, status')
        .ilike('name', `%${val.trim()}%`)
        .eq('status', '활성')
        .limit(15)
      setAddTmSearching(false)
      setAddTmResults(data || [])
    }, 350)
  }

  function handleTmAddMember(m) {
    if (addTeamMembers.find(x => x.member_id === m.member_id)) return
    setAddTeamMembers(prev => [...prev, {
      member_id: m.member_id, name: m.name, club: m.club,
      gender: m.gender || '', grade: m.grade || '',
    }])
    setAddTmSearch('')
    setAddTmResults([])
  }

  function handleTmRemoveMember(id) {
    setAddTeamMembers(prev => prev.filter(x => x.member_id !== id))
  }

  // ── 개인전 직접 등록 저장 ──
  async function handleAddIndividual() {
    if (!addDivisionId) { showToast?.('부서를 선택해주세요.', 'error'); return }
    if (!addM1Selected) { showToast?.('선수1(신청자)을 선택해주세요.', 'error'); return }
    if (!addM2Selected) { showToast?.('선수2(파트너)를 선택해주세요.', 'error'); return }
    if (addM1Selected.member_id === addM2Selected.member_id) {
      showToast?.('선수1과 선수2가 같습니다.', 'error'); return
    }

    setAddSubmitting(true)
    try {
      // 1. teams 테이블에 팀 생성
      const teamName = `${addM1Selected.name}/${addM2Selected.name}`
      const { data: teamData, error: teamErr } = await supabase
        .from('teams')
        .insert({ team_name: teamName, member1_id: addM1Selected.member_id, member2_id: addM2Selected.member_id })
        .select('team_id')
        .single()
      if (teamErr) throw teamErr

      // 2. event_entries 에 신청 등록
      const { error: entryErr } = await supabase
        .from('event_entries')
        .insert({
          event_id:       selectedEventId,
          team_id:        teamData.team_id,
          division_id:    addDivisionId,
          entry_status:   '신청',
          payment_status: '미납',
          applied_at:     new Date().toISOString(),
        })
      if (entryErr) throw entryErr

      showToast?.('✅ 개인전 직접 등록 완료!')
      closeAddModal()
      fetchEntries()
    } catch (err) {
      showToast?.('등록 실패: ' + err.message, 'error')
    } finally {
      setAddSubmitting(false)
    }
  }

  // ── 단체전 직접 등록 저장 ──
  async function handleAddTeam() {
    if (!addClubName.trim()) { showToast?.('클럽명을 입력해주세요.', 'error'); return }
    if (!addCaptainName.trim()) { showToast?.('대표자(주장) 이름을 입력해주세요.', 'error'); return }
    if (addTeamMembers.length === 0) { showToast?.('선수를 1명 이상 추가해주세요.', 'error'); return }

    setAddSubmitting(true)
    try {
      const { data: entry, error: entryErr } = await supabase
        .from('team_event_entries')
        .insert({
          event_id:      selectedEventId,
          club_name:     addClubName.trim(),
          captain_name:  addCaptainName.trim(),
          captain_pin:   '',
          division_name: addTeamDivision || null,
          status:        'confirmed',
          payment_status:'미납',
          created_at:    new Date().toISOString(),
        })
        .select('id')
        .single()
      if (entryErr) throw entryErr

      const { error: memberErr } = await supabase
        .from('team_event_members')
        .insert(addTeamMembers.map((m, i) => ({
          entry_id:     entry.id,
          member_id:    m.member_id || null,
          member_name:  m.name,
          gender:       m.gender || '',
          grade:        m.grade || '',
          member_order: i + 1,
        })))
      if (memberErr) {
        await supabase.from('team_event_entries').delete().eq('id', entry.id)
        throw memberErr
      }

      showToast?.('✅ 단체전 직접 등록 완료!')
      closeAddModal()
      fetchTeamEntries()
    } catch (err) {
      showToast?.('등록 실패: ' + err.message, 'error')
    } finally {
      setAddSubmitting(false)
    }
  }

  function formatDate(str) {
    if (!str) return '-'
    return new Date(str).toLocaleDateString('ko-KR')
  }

  function payBadgeClass(status) {
    if (status === '결제완료') return 'bg-green-50 text-green-700'
    if (status === '현장납부') return 'bg-yellow-50 text-yellow-700'
    if (status === '환불대기') return 'bg-orange-50 text-orange-700'
    if (status === '환불완료') return 'bg-gray-100 text-gray-500'
    return 'bg-red-50 text-red-600'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">📋 참가신청 관리</h2>
        {selectedEventId && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white text-sm
              font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            <span className="text-base leading-none">➕</span>
            직접 등록
          </button>
        )}
      </div>

      {/* 대회 선택 + 유형/결제 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={selectedEventId}
          onChange={e => { setSelectedEventId(e.target.value); setEntries([]); setTeamEntries([]) }}
          className="flex-1 min-w-[200px] text-sm border border-line rounded-lg px-3 py-2">
          <option value="">대회 선택</option>
          {events.map(ev => (
            <option key={ev.event_id} value={ev.event_id}>
              {ev.event_name} ({ev.event_date})
            </option>
          ))}
        </select>

        {/* ★ 이름 검색 */}
        <input
          type="text"
          value={filterName}
          onChange={e => setFilterName(e.target.value)}
          placeholder="이름 검색..."
          className="text-sm border border-line rounded-lg px-3 py-2 w-32"
        />

        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">전체 유형</option>
          <option value="개인">개인전만</option>
          <option value="단체">단체전만</option>
        </select>
        <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">전체 결제상태</option>
          <option value="미납">미납만</option>
          <option value="결제완료">결제완료만</option>
          <option value="현장납부">현장납부</option>
          <option value="환불대기">환불대기만</option>
          <option value="환불완료">환불완료만</option>
        </select>
      </div>

      {/* ── 카운트 탭 ── */}
      {selectedEventId && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setFilterPayment('')}
            className={`px-3 py-2 rounded-lg text-left transition-colors ${
              filterPayment === '' ? 'bg-accent text-white' : 'bg-soft text-gray-700 hover:bg-soft2'
            }`}>
            <p className="text-[10px] opacity-80">전체</p>
            <p className="text-lg font-bold">{totalCount}팀</p>
          </button>
          <button
            onClick={() => setFilterPayment(filterPayment === '결제완료' ? '' : '결제완료')}
            className={`px-3 py-2 rounded-lg text-left transition-colors ${
              filterPayment === '결제완료' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}>
            <p className="text-[10px] opacity-80">결제완료</p>
            <p className="text-lg font-bold">{paidCount}팀</p>
          </button>
          <button
            onClick={() => setFilterPayment(filterPayment === '미납' ? '' : '미납')}
            className={`px-3 py-2 rounded-lg text-left transition-colors ${
              filterPayment === '미납' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}>
            <p className="text-[10px] opacity-80">미납</p>
            <p className="text-lg font-bold">{unpaidCount}팀</p>
          </button>
          {refundCount > 0 && (
            <button
              onClick={() => setFilterPayment(filterPayment === '환불대기' ? '' : '환불대기')}
              className={`px-3 py-2 rounded-lg text-left transition-colors ${
                filterPayment === '환불대기'
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
              }`}>
              <p className="text-[10px] opacity-80">환불대기</p>
              <p className="text-lg font-bold">{refundCount}팀</p>
            </button>
          )}
        </div>
      )}

      {/* ── 엔트리 목록 ── */}
      {!selectedEventId ? (
        <p className="text-center py-8 text-sub text-sm">대회를 선택해주세요.</p>
      ) : loading ? (
        <p className="text-center py-8 text-sub text-sm">로딩 중...</p>
      ) : (
        <div className="bg-white rounded-r border border-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-soft2">
              <tr>
                <th className="px-3 py-2 text-center text-sub font-medium">유형</th>
                <th className="px-3 py-2 text-left text-sub font-medium">부서</th>
                <th className="px-3 py-2 text-left text-sub font-medium">팀/클럽</th>
                <th className="px-3 py-2 text-center text-sub font-medium">성별</th>
                <th className="px-3 py-2 text-center text-sub font-medium">상태</th>
                <th className="px-3 py-2 text-center text-sub font-medium">결제</th>
                <th className="px-3 py-2 text-left text-sub font-medium">신청일</th>
                <th className="px-3 py-2 text-center text-sub font-medium">액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-sub">신청 내역 없음</td>
                </tr>
              ) : filtered.map(e => (
                <tr
                  key={`${e._source}-${e.id}`}
                  className={`border-t border-line hover:bg-soft ${
                    e.payment_status === '환불대기' ? 'bg-orange-50/40' : ''
                  }`}>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      e.type === '단체' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>{e.type}</span>
                  </td>
                  <td className="px-3 py-2">{e.division}</td>
                  <td className="px-3 py-2 font-medium">{e.name}</td>
                  <td className="px-3 py-2 text-center">
                    {e._source === 'team'
                      ? <span className="text-xs text-gray-600">{e.gender || '-'}</span>
                      : <span className="text-xs text-gray-400">-</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                      {e.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${payBadgeClass(e.payment_status)}`}>
                      {e.payment_status || '미납'}
                    </span>
                    {/* 환불대기: 계좌 정보 미리보기 */}
                    {e.payment_status === '환불대기' && e._raw && (
                      <div className="text-[10px] text-orange-700 mt-0.5 text-left">
                        {e._raw.refund_bank} {e._raw.refund_account}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-sub">
                    {e.date ? new Date(e.date).toLocaleDateString('ko-KR') : '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {/* 환불대기 → 환불 처리 버튼만 표시 */}
                      {e.payment_status === '환불대기' ? (
                        <button
                          onClick={() => setRefundModal(e)}
                          className="text-xs text-orange-600 border border-orange-200 bg-orange-50
                            hover:bg-orange-100 rounded px-2 py-0.5 font-medium">
                          환불 처리
                        </button>
                      ) : e.payment_status === '환불완료' ? (
                        <span className="text-xs text-gray-400">완료</span>
                      ) : (
                        <>
                          {/* 개인전만 선수 변경 버튼 */}
                          {e._source === 'individual' && (
                            <button
                              onClick={() => openEditModal(e, 'member1')}
                              className="text-xs text-purple-600 border border-purple-200 bg-purple-50
                                hover:bg-purple-100 rounded px-2 py-0.5">
                              신청자
                            </button>
                          )}
                          {e._source === 'individual' && (
                            <button
                              onClick={() => openEditModal(e, 'member2')}
                              className="text-xs text-blue-600 border border-blue-200 bg-blue-50
                                hover:bg-blue-100 rounded px-2 py-0.5">
                              파트너
                            </button>
                          )}
                          {/* 단체전 명단 수정 */}
                          {e._source === 'team' && (
                            <button
                              onClick={() => openTeamEditModal(e._raw)}
                              className="text-xs text-indigo-600 border border-indigo-200 bg-indigo-50
                                hover:bg-indigo-100 rounded px-2 py-0.5">
                              명단수정
                            </button>
                          )}
                          {e.payment_status !== '결제완료' && (
                            <button onClick={() => handlePaymentSet(e, '결제완료')}
                              className="text-xs text-green-600 hover:underline">결제확인</button>
                          )}
                          {e.payment_status !== '현장납부' && e.payment_status !== '결제완료' && (
                            <button onClick={() => handlePaymentSet(e, '현장납부')}
                              className="text-xs text-yellow-600 hover:underline">현장납부</button>
                          )}
                          <button onClick={() => handleCancelConfirm(e)}
                            className="text-xs text-red-500 hover:underline">취소</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 관리자 취소 확인 모달 ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm z-10">
            <p className="text-sm text-gray-800 mb-5 whitespace-pre-line">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">
                취소
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 환불 처리 모달 ── */}
      {refundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRefundModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm z-10">
            <h3 className="text-base font-semibold text-gray-900 mb-4">환불 처리 확인</h3>

            {/* 신청 정보 */}
            <div className="bg-soft rounded-xl px-4 py-3 mb-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-sub">회원</span>
                <span className="font-medium">{refundModal.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-sub">부서</span>
                <span>{refundModal.division}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-sub">신청일</span>
                <span>{formatDate(refundModal.date)}</span>
              </div>
              {refundModal._raw?.refund_requested_at && (
                <div className="flex justify-between text-xs">
                  <span className="text-sub">취소 신청일</span>
                  <span>{formatDate(refundModal._raw.refund_requested_at)}</span>
                </div>
              )}
            </div>

            {/* 환불 계좌 */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-5 space-y-1.5">
              <p className="text-xs font-semibold text-orange-800 mb-1">환불 계좌 (회원 입력)</p>
              <div className="flex justify-between text-xs">
                <span className="text-orange-700">은행</span>
                <span className="font-medium text-orange-900">{refundModal._raw?.refund_bank || '-'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-orange-700">계좌번호</span>
                <span className="font-medium text-orange-900">{refundModal._raw?.refund_account || '-'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-orange-700">예금주</span>
                <span className="font-medium text-orange-900">{refundModal._raw?.refund_holder || '-'}</span>
              </div>
            </div>

            <p className="text-xs text-sub mb-5 leading-relaxed">
              위 계좌로 환불 입금 후 "환불 완료" 버튼을 눌러주세요.
              처리 후 결제 상태가 "환불완료"로 변경됩니다.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setRefundModal(null)}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">
                닫기
              </button>
              <button
                onClick={handleRefundComplete}
                disabled={refunding}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold
                  hover:bg-green-700 disabled:opacity-50">
                {refunding ? '처리 중...' : '환불 완료 처리'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── 선수 변경 모달 (관리자) ── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeEditModal} />
          <div className="relative bg-white rounded-2xl p-5 w-full max-w-sm z-10">
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {editField === 'member1' ? '신청자 변경' : '파트너 변경'}
            </h3>

            {/* 현재 선수 */}
            <div className="bg-soft rounded-xl px-4 py-2.5 mb-4">
              <p className="text-xs text-sub mb-0.5">현재 {editField === 'member1' ? '신청자' : '파트너'}</p>
              <p className="text-sm font-semibold text-gray-900">
                {editField === 'member1'
                  ? (editModal._raw?._m1?.name || '-')
                  : (editModal._raw?._m2?.name || '-')}
              </p>
              <p className="text-xs text-sub mt-0.5">{editModal.division} · {editModal.name}</p>
            </div>

            {/* 검색 */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={editSearch}
                onChange={e => setEditSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEditSearch()}
                placeholder="회원 이름 검색"
                className="flex-1 text-sm border border-line rounded-lg px-3 py-2" />
              <button
                onClick={handleEditSearch}
                disabled={editSearching || !editSearch.trim()}
                className="px-3 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-50">
                {editSearching ? '...' : '검색'}
              </button>
            </div>

            {/* 검색 결과 */}
            {editResults.length > 0 && (
              <div className="border border-line rounded-xl overflow-hidden mb-3 max-h-44 overflow-y-auto">
                {editResults.map(m => (
                  <button
                    key={m.member_id}
                    disabled={m.disabled}
                    onClick={() => !m.disabled && setEditSelected(m)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left
                      border-b border-line last:border-0 transition-colors
                      ${editSelected?.member_id === m.member_id
                        ? 'bg-blue-50'
                        : m.disabled
                          ? 'opacity-40 cursor-not-allowed bg-gray-50'
                          : 'hover:bg-soft'
                      }`}>
                    <div>
                      <span className="text-sm font-medium">{m.name}</span>
                      {m.club && <span className="text-xs text-sub ml-1.5">({m.club})</span>}
                    </div>
                    {m.disabled
                      ? <span className="text-[10px] text-gray-400">{m.disabledReason}</span>
                      : editSelected?.member_id === m.member_id
                        ? <span className="text-xs text-blue-500 font-medium">✓</span>
                        : null
                    }
                  </button>
                ))}
              </div>
            )}

            {/* 선택된 새 선수 */}
            {editSelected && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-4">
                <p className="text-xs text-blue-600 mb-0.5">변경할 선수</p>
                <p className="text-sm font-semibold text-blue-800">
                  {editSelected.name}
                  {editSelected.club && <span className="font-normal text-blue-600 ml-1">({editSelected.club})</span>}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeEditModal}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">
                닫기
              </button>
              <button
                onClick={handleEditSave}
                disabled={!editSelected || editSaving}
                className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold
                  hover:bg-blue-700 disabled:opacity-50">
                {editSaving ? '저장 중...' : '변경 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── 단체전 명단 수정 모달 (관리자) ── */}
      {teamEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeTeamEditModal} />
          <div className="relative bg-white rounded-2xl w-full max-w-md z-10 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div>
                <h3 className="text-base font-bold text-gray-900">👥 단체전 명단 수정</h3>
                <p className="text-xs text-sub mt-0.5">
                  {teamEditModal.club_name} · {teamEditModal.division_name || '-'} · 주장 {teamEditModal.captain_name}
                </p>
              </div>
              <button onClick={closeTeamEditModal}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-soft text-sub text-lg">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">선수 추가</label>
                <div className="relative">
                  <input
                    type="text"
                    value={teamEditSearch}
                    onChange={e => handleTeamEditSearchChange(e.target.value)}
                    placeholder="이름으로 검색하여 추가..."
                    className="w-full text-sm border border-line rounded-lg px-3 py-2.5 pr-8" />
                  {teamEditSearching && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sub">⏳</span>
                  )}
                </div>
                {teamEditResults.length > 0 && (
                  <div className="border border-line rounded-xl mt-1 overflow-hidden max-h-36 overflow-y-auto">
                    {teamEditResults.map(m => {
                      const already = teamEditMembers.some(x => x.member_id === m.member_id)
                      return (
                        <button
                          key={m.member_id}
                          onClick={() => !already && handleTeamEditAdd(m)}
                          disabled={already}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left
                            border-b border-line last:border-0 transition-colors
                            ${already ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'hover:bg-soft'}`}>
                          <span className="text-sm font-medium">{m.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-sub">{m.club || ''}</span>
                            {already
                              ? <span className="text-xs text-gray-400">추가됨</span>
                              : <span className="text-xs text-accent font-medium">+ 추가</span>
                            }
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {teamEditMembers.length > 0 && (
                <div className="border border-line rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-soft border-b border-line">
                    <span className="text-xs font-medium text-gray-700">
                      선수 명단 ({teamEditMembers.length}명)
                    </span>
                  </div>
                  {teamEditMembers.map((m, i) => (
                    <div key={m.member_id || `r-${i}`}
                      className="flex items-center justify-between px-3 py-2 border-b border-line last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-sub w-5">{i + 1}</span>
                        <span className="text-sm font-medium">{m.member_name}</span>
                        {m.gender && (
                          <span className="text-[10px] text-sub">
                            ({m.gender === 'M' || m.gender === '남' ? '남' : m.gender === 'F' || m.gender === '여' ? '여' : m.gender})
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleTeamEditRemove(m.member_id)}
                        className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 pb-5 pt-3 border-t border-line flex gap-3">
              <button
                onClick={closeTeamEditModal}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">
                닫기
              </button>
              <button
                onClick={handleTeamEditSave}
                disabled={teamEditSaving}
                className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold
                  hover:bg-blue-700 disabled:opacity-50">
                {teamEditSaving ? '저장 중...' : '✅ 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 관리자 직접 등록 모달 ── */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeAddModal} />
          <div className="relative bg-white rounded-2xl w-full max-w-md z-10 flex flex-col max-h-[90vh]">

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="text-base font-bold text-gray-900">➕ 관리자 직접 등록</h3>
              <button onClick={closeAddModal}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-soft text-sub text-lg">
                ✕
              </button>
            </div>

            {/* 탭 */}
            <div className="flex gap-1 p-4 pb-0">
              <button
                onClick={() => setAddTab('individual')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  addTab === 'individual'
                    ? 'bg-accent text-white'
                    : 'bg-soft text-sub hover:bg-soft2'
                }`}>
                🎾 개인전
              </button>
              <button
                onClick={() => setAddTab('team')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  addTab === 'team'
                    ? 'bg-accent text-white'
                    : 'bg-soft text-sub hover:bg-soft2'
                }`}>
                👥 단체전
              </button>
            </div>

            {/* 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* ──── 개인전 등록 ──── */}
              {addTab === 'individual' && (
                <>
                  {/* 부서 선택 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      부서 선택 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={addDivisionId}
                      onChange={e => setAddDivisionId(e.target.value)}
                      className="w-full text-sm border border-line rounded-lg px-3 py-2.5">
                      <option value="">부서를 선택하세요</option>
                      {addDivisions.map(d => (
                        <option key={d.division_id} value={d.division_id}>
                          {d.division_name}
                        </option>
                      ))}
                    </select>
                    {addDivisions.length === 0 && (
                      <p className="text-xs text-orange-600 mt-1">
                        ⚠️ 이 대회에 등록된 부서가 없습니다. 먼저 대회 관리에서 부서를 추가해주세요.
                      </p>
                    )}
                  </div>

                  {/* 선수1 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      선수1 (신청자) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={addM1Search}
                        onChange={e => handleM1SearchChange(e.target.value)}
                        placeholder="이름으로 검색..."
                        className="w-full text-sm border border-line rounded-lg px-3 py-2.5 pr-8" />
                      {addM1Searching && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sub">⏳</span>
                      )}
                    </div>
                    {addM1Results.length > 0 && !addM1Selected && (
                      <div className="border border-line rounded-xl mt-1 overflow-hidden max-h-36 overflow-y-auto">
                        {addM1Results.map(m => (
                          <button
                            key={m.member_id}
                            onClick={() => { setAddM1Selected(m); setAddM1Search(m.name); setAddM1Results([]) }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left
                              border-b border-line last:border-0 hover:bg-soft transition-colors
                              ${addM2Selected?.member_id === m.member_id ? 'opacity-40 cursor-not-allowed' : ''}`}
                            disabled={addM2Selected?.member_id === m.member_id}>
                            <span className="text-sm font-medium">{m.name}</span>
                            <span className="text-xs text-sub">{m.club || ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {addM1Selected && (
                      <div className="mt-1 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-blue-800">{addM1Selected.name}</span>
                          {addM1Selected.club && <span className="text-xs text-blue-600 ml-1.5">({addM1Selected.club})</span>}
                        </div>
                        <button onClick={() => { setAddM1Selected(null); setAddM1Search('') }}
                          className="text-blue-400 hover:text-blue-600 text-sm ml-2">✕</button>
                      </div>
                    )}
                  </div>

                  {/* 선수2 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      선수2 (파트너) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={addM2Search}
                        onChange={e => handleM2SearchChange(e.target.value)}
                        placeholder="이름으로 검색..."
                        className="w-full text-sm border border-line rounded-lg px-3 py-2.5 pr-8" />
                      {addM2Searching && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sub">⏳</span>
                      )}
                    </div>
                    {addM2Results.length > 0 && !addM2Selected && (
                      <div className="border border-line rounded-xl mt-1 overflow-hidden max-h-36 overflow-y-auto">
                        {addM2Results.map(m => (
                          <button
                            key={m.member_id}
                            onClick={() => { setAddM2Selected(m); setAddM2Search(m.name); setAddM2Results([]) }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left
                              border-b border-line last:border-0 hover:bg-soft transition-colors
                              ${addM1Selected?.member_id === m.member_id ? 'opacity-40 cursor-not-allowed' : ''}`}
                            disabled={addM1Selected?.member_id === m.member_id}>
                            <span className="text-sm font-medium">{m.name}</span>
                            <span className="text-xs text-sub">{m.club || ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {addM2Selected && (
                      <div className="mt-1 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-blue-800">{addM2Selected.name}</span>
                          {addM2Selected.club && <span className="text-xs text-blue-600 ml-1.5">({addM2Selected.club})</span>}
                        </div>
                        <button onClick={() => { setAddM2Selected(null); setAddM2Search('') }}
                          className="text-blue-400 hover:text-blue-600 text-sm ml-2">✕</button>
                      </div>
                    )}
                  </div>

                  {/* 등록 요약 */}
                  {addM1Selected && addM2Selected && addDivisionId && (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      <p className="text-xs font-semibold text-green-800 mb-1.5">📋 등록 내용 확인</p>
                      <p className="text-xs text-green-700">
                        부서: <span className="font-medium">
                          {addDivisions.find(d => d.division_id === addDivisionId)?.division_name}
                        </span>
                      </p>
                      <p className="text-xs text-green-700 mt-0.5">
                        팀: <span className="font-medium">{addM1Selected.name} / {addM2Selected.name}</span>
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* ──── 단체전 등록 ──── */}
              {addTab === 'team' && (
                <>
                  {/* 클럽명 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      클럽명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={addClubName}
                      onChange={e => setAddClubName(e.target.value)}
                      placeholder="클럽 이름 입력"
                      className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
                  </div>

                  {/* 대표자(주장) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      대표자(주장) 이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={addCaptainName}
                      onChange={e => setAddCaptainName(e.target.value)}
                      placeholder="주장 이름 입력"
                      className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
                  </div>

                  {/* 부서/조 (선택) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">부서/조 (선택)</label>
                    <input
                      type="text"
                      value={addTeamDivision}
                      onChange={e => setAddTeamDivision(e.target.value)}
                      placeholder="예: A조, 1부"
                      className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
                  </div>

                  {/* 선수 추가 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      선수 추가 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={addTmSearch}
                        onChange={e => handleTmSearchChange(e.target.value)}
                        placeholder="이름으로 검색하여 추가..."
                        className="w-full text-sm border border-line rounded-lg px-3 py-2.5 pr-8" />
                      {addTmSearching && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sub">⏳</span>
                      )}
                    </div>

                    {addTmResults.length > 0 && (
                      <div className="border border-line rounded-xl mt-1 overflow-hidden max-h-36 overflow-y-auto">
                        {addTmResults.map(m => {
                          const already = addTeamMembers.some(x => x.member_id === m.member_id)
                          return (
                            <button
                              key={m.member_id}
                              onClick={() => !already && handleTmAddMember(m)}
                              disabled={already}
                              className={`w-full flex items-center justify-between px-3 py-2 text-left
                                border-b border-line last:border-0 transition-colors
                                ${already ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'hover:bg-soft'}`}>
                              <span className="text-sm font-medium">{m.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-sub">{m.club || ''}</span>
                                {already
                                  ? <span className="text-xs text-gray-400">추가됨</span>
                                  : <span className="text-xs text-accent font-medium">+ 추가</span>
                                }
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* 선수 명단 */}
                    {addTeamMembers.length > 0 && (
                      <div className="mt-2 border border-line rounded-xl overflow-hidden">
                        <div className="px-3 py-2 bg-soft border-b border-line">
                          <span className="text-xs font-medium text-gray-700">
                            선수 명단 ({addTeamMembers.length}명)
                          </span>
                        </div>
                        {addTeamMembers.map((m, i) => (
                          <div key={m.member_id}
                            className="flex items-center justify-between px-3 py-2 border-b border-line last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-sub w-5">{i + 1}</span>
                              <span className="text-sm font-medium">{m.name}</span>
                              {m.club && <span className="text-xs text-sub">({m.club})</span>}
                            </div>
                            <button
                              onClick={() => handleTmRemoveMember(m.member_id)}
                              className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="px-5 pb-5 pt-3 border-t border-line flex gap-3">
              <button
                onClick={closeAddModal}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">
                닫기
              </button>
              <button
                onClick={addTab === 'individual' ? handleAddIndividual : handleAddTeam}
                disabled={addSubmitting}
                className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold
                  hover:bg-blue-700 disabled:opacity-50">
                {addSubmitting ? '등록 중...' : '✅ 등록 완료'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
