import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

// 포인트 규정에서 가져오는 부서 목록 (DB에서 동적 로드)
// division_name 입력 시 이 목록에서 선택하도록 드롭다운 제공

export default function EventAdmin() {
  const showToast = useContext(ToastContext)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    event_name: '', event_date: '', event_date_end: '', entry_fee_team: '',
    entry_open_at: '', entry_close_at: '', description: '', tournament_id: '',
    event_type: 'individual', team_match_type: '3_doubles', team_division_id: '',
    account_number: '', account_holder: '', account_bank: '',
  })
  const [tournaments, setTournaments] = useState([])
  const [pointRuleDivisions, setPointRuleDivisions] = useState([]) // 포인트 규정 부서 목록

  // 부서 관리
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventDivisions, setEventDivisions] = useState([])
  const [divForm, setDivForm] = useState({ division_name: '', has_groups: false })

  // 대회 수정 모달
  const [editingEvent, setEditingEvent] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showEditModal, setShowEditModal] = useState(false)

  // 팀전 설정 수정 (기존)
  const [editingTeamSettings, setEditingTeamSettings] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: evts }, { data: tours }, { data: rules }] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: false }),
      supabase.from('tournaments_master').select('*').order('date', { ascending: false }),
      supabase.from('point_rules').select('division').order('sort_order', { ascending: true, nullsFirst: false }),
    ])
    setEvents(evts || [])
    setTournaments(tours || [])
    setPointRuleDivisions((rules || []).map(r => r.division).filter(Boolean))
    setLoading(false)
  }

  async function fetchDivisions(eventId) {
    // event_divisions를 가져온 뒤 point_rules의 sort_order 순서에 맞게 정렬
    const [{ data: divs }, { data: prules }] = await Promise.all([
      supabase.from('event_divisions').select('*').eq('event_id', eventId),
      supabase.from('point_rules').select('division, sort_order').order('sort_order', { ascending: true, nullsFirst: false }),
    ])
    const sorted = (divs || []).sort((a, b) => {
      const ai = (prules || []).findIndex(r => r.division === a.division_name)
      const bi = (prules || []).findIndex(r => r.division === b.division_name)
      const aOrder = ai === -1 ? 9999 : ai
      const bOrder = bi === -1 ? 9999 : bi
      return aOrder - bOrder
    })
    setEventDivisions(sorted)
    return sorted
  }

  // ── 대회 생성 ──────────────────────────────────
  // datetime-local → ISO UTC 변환 (브라우저가 로컬→UTC 자동 변환)
  function toUTC(localStr) {
    if (!localStr) return null
    return new Date(localStr).toISOString()
  }

  async function handleAddEvent() {
    if (!form.event_name || !form.event_date) {
      showToast?.('대회명과 날짜는 필수입니다.', 'error'); return
    }
    const insertData = {
      event_name: form.event_name,
      event_date: form.event_date,
      event_date_end: form.event_date_end || null,
      entry_fee_team: form.entry_fee_team ? Number(form.entry_fee_team) : 0,
      entry_open_at: toUTC(form.entry_open_at),
      entry_close_at: toUTC(form.entry_close_at),
      tournament_id: form.tournament_id || null,
      description: form.description || null,
      event_type: form.event_type,
      team_match_type: (form.event_type === 'team' || form.event_type === 'both') ? form.team_match_type : null,
      team_division_id: (form.event_type === 'team' || form.event_type === 'both') ? (form.team_division_id || null) : null,
      account_number: form.account_number || null,
      account_holder: form.account_holder || null,
      account_bank: form.account_bank || null,
    }
    const { error } = await supabase.from('events').insert([insertData])
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.('대회가 생성되었습니다.')
    setShowForm(false)
    setForm({
      event_name: '', event_date: '', event_date_end: '', entry_fee_team: '', entry_open_at: '', entry_close_at: '',
      description: '', tournament_id: '', event_type: 'individual', team_match_type: '3_doubles', team_division_id: '',
      account_number: '', account_holder: '', account_bank: '',
    })
    fetchAll()
  }

  // ── 대회 수정 열기 ──────────────────────────────
  // UTC → datetime-local 변환 (브라우저가 자동으로 로컬시간=KST로 표시)
  function toKSTLocal(utcStr) {
    if (!utcStr) return ''
    const d = new Date(utcStr)
    // datetime-local 형식: YYYY-MM-DDTHH:MM (로컬시간 기준)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function openEditModal(ev) {
    setEditingEvent(ev)
    setEditForm({
      event_name: ev.event_name || '',
      event_date: ev.event_date || '',
      event_date_end: ev.event_date_end || '',
      entry_fee_team: ev.entry_fee_team || '',
      entry_open_at: toKSTLocal(ev.entry_open_at),
      entry_close_at: toKSTLocal(ev.entry_close_at),
      description: ev.description || '',
      tournament_id: ev.tournament_id || '',
      account_number: ev.account_number || '',
      account_holder: ev.account_holder || '',
      account_bank: ev.account_bank || '',
    })
    setShowEditModal(true)
  }

  // ── 대회 수정 저장 ──────────────────────────────
  async function handleUpdateEvent() {
    if (!editForm.event_name || !editForm.event_date) {
      showToast?.('대회명과 날짜는 필수입니다.', 'error'); return
    }
    const updates = {
      event_name: editForm.event_name,
      event_date: editForm.event_date,
      event_date_end: editForm.event_date_end || null,
      entry_fee_team: editForm.entry_fee_team ? Number(editForm.entry_fee_team) : 0,
      entry_open_at: toUTC(editForm.entry_open_at),
      entry_close_at: toUTC(editForm.entry_close_at),
      description: editForm.description || null,
      tournament_id: editForm.tournament_id || null,
      account_number: editForm.account_number || null,
      account_holder: editForm.account_holder || null,
      account_bank: editForm.account_bank || null,
    }
    const { error } = await supabase.from('events').update(updates).eq('event_id', editingEvent.event_id)
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.('대회 정보가 수정되었습니다.')
    setShowEditModal(false)
    setEditingEvent(null)
    // 선택된 이벤트도 갱신
    if (selectedEvent?.event_id === editingEvent.event_id) {
      setSelectedEvent({ ...selectedEvent, ...updates })
    }
    fetchAll()
  }

  // ── OPEN/CLOSED 토글 ────────────────────────────
  async function toggleEventStatus(ev) {
    const newStatus = ev.status === 'OPEN' ? 'CLOSED' : 'OPEN'
    await supabase.from('events').update({ status: newStatus }).eq('event_id', ev.event_id)
    showToast?.(`${ev.event_name} → ${newStatus}`)
    fetchAll()
  }

  // ── 대회 삭제 ──────────────────────────────────
  async function handleDeleteEvent(ev) {
    const confirmMsg = `⚠️ "${ev.event_name}" 대회를 삭제하시겠습니까?\n\n다음 데이터가 모두 삭제됩니다:\n- 개인전 참가신청 및 결제내역\n- 팀전 참가신청 및 선수명단\n- 부서정보\n- AB 경기결과\n\n이 작업은 되돌릴 수 없습니다.`
    if (!confirm(confirmMsg)) return
    try {
      const eid = ev.event_id
      const { data: teamEntries } = await supabase.from('team_event_entries').select('id').eq('event_id', eid)
      if (teamEntries?.length > 0) {
        const entryIds = teamEntries.map(e => e.id)
        await supabase.from('team_event_members').delete().in('entry_id', entryIds)
      }
      await supabase.from('team_event_entries').delete().eq('event_id', eid)
      await supabase.from('payments').delete().eq('target_event_id', eid)
      await supabase.from('event_entries').delete().eq('event_id', eid)
      await supabase.from('app_b_match_results').delete().eq('event_id', eid)
      await supabase.from('event_divisions').delete().eq('event_id', eid)
      const { error } = await supabase.from('events').delete().eq('event_id', eid)
      if (error) throw error
      showToast?.(`"${ev.event_name}" 대회가 삭제되었습니다.`)
      setSelectedEvent(null)
      setEventDivisions([])
      fetchAll()
    } catch (err) {
      showToast?.('삭제 실패: ' + (err.message || '알 수 없는 오류'), 'error')
    }
  }

  // ── 팀전 설정 수정 ──────────────────────────────
  async function handleUpdateTeamSettings() {
    if (!editingTeamSettings) return
    const updates = {
      event_type: editingTeamSettings.event_type,
      team_match_type: (editingTeamSettings.event_type === 'team' || editingTeamSettings.event_type === 'both')
        ? editingTeamSettings.team_match_type : null,
      team_division_id: (editingTeamSettings.event_type === 'team' || editingTeamSettings.event_type === 'both')
        ? (editingTeamSettings.team_division_id || null) : null,
    }
    const { error } = await supabase.from('events').update(updates).eq('event_id', editingTeamSettings.event_id)
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.('팀전 설정이 저장되었습니다.')
    setEditingTeamSettings(null)
    fetchAll()
  }

  // ── 부서 추가 ──────────────────────────────────
  async function handleAddDivision() {
    if (!divForm.division_name || !selectedEvent) {
      showToast?.('부서명을 입력해주세요.', 'error'); return
    }
    const { error } = await supabase.from('event_divisions').insert([{
      event_id: selectedEvent.event_id,
      division_name: divForm.division_name,
      has_groups: divForm.has_groups,
    }])
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.('부서가 추가되었습니다.')
    setDivForm({ division_name: '', has_groups: false })
    fetchDivisions(selectedEvent.event_id)
  }

  async function deleteDivision(divId) {
    if (!confirm('이 부서를 삭제하시겠습니까?')) return
    await supabase.from('event_divisions').delete().eq('division_id', divId)
    showToast?.('삭제됨')
    if (selectedEvent) fetchDivisions(selectedEvent.event_id)
  }

  async function updateGroupsStatus(divId, status) {
    await supabase.from('event_divisions').update({ groups_status: status }).eq('division_id', divId)
    showToast?.('조별리그 상태 변경: ' + status)
    if (selectedEvent) fetchDivisions(selectedEvent.event_id)
  }

  function getEventTypeBadge(ev) {
    if (ev.event_type === 'team') return { label: '팀전', color: 'bg-blue-50 text-blue-700' }
    if (ev.event_type === 'both') return { label: '개인+팀', color: 'bg-purple-50 text-purple-700' }
    return { label: '개인', color: 'bg-gray-100 text-gray-600' }
  }

  function getMatchTypeLabel(type) {
    if (type === '5_doubles') return '5복식'
    if (type === '3_doubles') return '3복식'
    return '-'
  }

  function formatDateTime(str) {
    if (!str) return '-'
    // KST(한국시간) 기준으로 표시 (UTC+9)
    return new Date(str).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">🗓 대회/이벤트 관리</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + 대회생성
        </button>
      </div>

      {/* 대회 생성 폼 */}
      {showForm && (
        <div className="bg-white rounded-r border border-line p-4 mb-4 space-y-3">
          <p className="text-sm font-bold text-gray-700">신규 대회 생성</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-sub mb-1">대회명 *</label>
              <input type="text" value={form.event_name}
                onChange={e => setForm({ ...form, event_name: e.target.value })}
                placeholder="예: 2026 봄 단식대회"
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">대회 시작일 *</label>
              <input type="date" value={form.event_date}
                onChange={e => setForm({ ...form, event_date: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">대회 종료일 <span className="text-gray-400">(2일이상)</span></label>
              <input type="date" value={form.event_date_end}
                min={form.event_date}
                onChange={e => setForm({ ...form, event_date_end: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>

            {/* 대회 유형 */}
            <div className="col-span-2">
              <label className="block text-xs text-sub mb-1">대회 유형 *</label>
              <div className="flex gap-2">
                {[
                  { value: 'individual', label: '👤 개인전', desc: '개인/복식 경기' },
                  { value: 'team', label: '👥 팀전', desc: '클럽 팀대항' },
                  { value: 'both', label: '👤+👥 개인+팀', desc: '복합 운영' },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm({ ...form, event_type: opt.value })}
                    className={`flex-1 p-3 rounded-lg border text-left transition-colors ${
                      form.event_type === opt.value ? 'border-accent bg-accentSoft' : 'border-line hover:bg-soft'
                    }`}>
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-sub mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {(form.event_type === 'team' || form.event_type === 'both') && (
              <div>
                <label className="block text-xs text-sub mb-1">경기 방식 *</label>
                <select value={form.team_match_type}
                  onChange={e => setForm({ ...form, team_match_type: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2">
                  <option value="3_doubles">3복식 (2판 선승)</option>
                  <option value="5_doubles">5복식 (3판 선승)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs text-sub mb-1">참가비 (팀/원)</label>
              <input type="number" value={form.entry_fee_team}
                onChange={e => setForm({ ...form, entry_fee_team: e.target.value })}
                placeholder="0"
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>

            {/* 계좌 정보 */}
            <div className="col-span-2">
              <label className="block text-xs text-sub mb-1">💳 입금 계좌</label>
              <div className="grid grid-cols-3 gap-2">
                <input type="text" value={form.account_bank}
                  onChange={e => setForm({ ...form, account_bank: e.target.value })}
                  placeholder="은행명"
                  className="text-sm border border-line rounded-lg px-3 py-2" />
                <input type="text" value={form.account_number}
                  onChange={e => setForm({ ...form, account_number: e.target.value })}
                  placeholder="계좌번호"
                  className="text-sm border border-line rounded-lg px-3 py-2" />
                <input type="text" value={form.account_holder}
                  onChange={e => setForm({ ...form, account_holder: e.target.value })}
                  placeholder="예금주"
                  className="text-sm border border-line rounded-lg px-3 py-2" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-sub mb-1">신청 시작</label>
              <input type="datetime-local" value={form.entry_open_at}
                onChange={e => setForm({ ...form, entry_open_at: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">신청 마감</label>
              <input type="datetime-local" value={form.entry_close_at}
                onChange={e => setForm({ ...form, entry_close_at: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-sub mb-1">연결 대회 마스터 (선택)</label>
              <select value={form.tournament_id}
                onChange={e => setForm({ ...form, tournament_id: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2">
                <option value="">없음</option>
                {tournaments.map(t => (
                  <option key={t.tournament_id} value={t.tournament_id}>{t.tournament_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddEvent}
              className="bg-accent text-white px-4 py-2 rounded-lg text-sm">생성</button>
            <button onClick={() => setShowForm(false)}
              className="text-sm text-sub px-4 py-2">취소</button>
          </div>
        </div>
      )}

      {/* 대회 목록 */}
      <div className="bg-white rounded-r border border-line overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead className="bg-soft2">
            <tr>
              <th className="px-3 py-2 text-left text-sub font-medium">대회명</th>
              <th className="px-3 py-2 text-left text-sub font-medium">날짜</th>
              <th className="px-3 py-2 text-left text-sub font-medium">신청기간</th>
              <th className="px-3 py-2 text-center text-sub font-medium">유형</th>
              <th className="px-3 py-2 text-center text-sub font-medium">상태</th>
              <th className="px-3 py-2 text-center text-sub font-medium">옵션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-sub">로딩 중..</td></tr>
            ) : events.map(ev => {
              const badge = getEventTypeBadge(ev)
              return (
                <tr key={ev.event_id}
                  className={`border-t border-line hover:bg-soft cursor-pointer ${selectedEvent?.event_id === ev.event_id ? 'bg-accentSoft' : ''}`}
                  onClick={() => { setSelectedEvent(ev); fetchDivisions(ev.event_id); setEditingTeamSettings(null) }}>
                  <td className="px-3 py-2 font-medium">{ev.event_name}</td>
                  <td className="px-3 py-2 text-sub">{ev.event_date}</td>
                  <td className="px-3 py-2 text-xs text-sub">
                    {ev.entry_open_at || ev.entry_close_at ? (
                      <span>{formatDateTime(ev.entry_open_at)} ~ {formatDateTime(ev.entry_close_at)}</span>
                    ) : <span className="text-gray-300">미설정</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${ev.status === 'OPEN' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {ev.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={e => { e.stopPropagation(); openEditModal(ev) }}
                        className="text-xs text-blue-500 hover:underline">수정</button>
                      <button onClick={e => { e.stopPropagation(); toggleEventStatus(ev) }}
                        className="text-xs text-accent hover:underline">
                        {ev.status === 'OPEN' ? '마감' : '오픈'}
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteEvent(ev) }}
                        className="text-xs text-red-500 hover:underline">삭제</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 선택된 대회의 팀전 설정 */}
      {selectedEvent && (selectedEvent.event_type === 'team' || selectedEvent.event_type === 'both') && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-blue-800">👥 팀전 설정</h3>
            {!editingTeamSettings ? (
              <button onClick={() => setEditingTeamSettings({ ...selectedEvent })}
                className="text-xs text-blue-600 hover:underline">수정</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleUpdateTeamSettings}
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded">저장</button>
                <button onClick={() => setEditingTeamSettings(null)}
                  className="text-xs text-sub">취소</button>
              </div>
            )}
          </div>
          {editingTeamSettings ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-blue-700 mb-1">대회 유형</label>
                <select value={editingTeamSettings.event_type}
                  onChange={e => setEditingTeamSettings({ ...editingTeamSettings, event_type: e.target.value })}
                  className="w-full text-sm border border-blue-200 rounded-lg px-3 py-2">
                  <option value="individual">개인전</option>
                  <option value="team">팀전</option>
                  <option value="both">개인+팀</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-blue-700 mb-1">경기 방식</label>
                <select value={editingTeamSettings.team_match_type || '3_doubles'}
                  onChange={e => setEditingTeamSettings({ ...editingTeamSettings, team_match_type: e.target.value })}
                  className="w-full text-sm border border-blue-200 rounded-lg px-3 py-2">
                  <option value="3_doubles">3복식 (2판 선승)</option>
                  <option value="5_doubles">5복식 (3판 선승)</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-blue-700 mb-1">팀전 참가부서</label>
                <select value={editingTeamSettings.team_division_id || ''}
                  onChange={e => setEditingTeamSettings({ ...editingTeamSettings, team_division_id: e.target.value || null })}
                  className="w-full text-sm border border-blue-200 rounded-lg px-3 py-2">
                  <option value="">미결정</option>
                  {eventDivisions.map(d => (
                    <option key={d.division_id} value={d.division_id}>{d.division_name}</option>
                  ))}
                </select>
                {eventDivisions.length === 0 && (
                  <p className="text-xs text-blue-600 mt-1">아래에서 부서를 먼저 추가하세요.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-xs text-blue-600">유형</span>
                <p className="font-medium">{getEventTypeBadge(selectedEvent).label}</p>
              </div>
              <div>
                <span className="text-xs text-blue-600">경기방식</span>
                <p className="font-medium">{getMatchTypeLabel(selectedEvent.team_match_type)}</p>
              </div>
              <div>
                <span className="text-xs text-blue-600">참가부서</span>
                <p className="font-medium">
                  {selectedEvent.team_division_id
                    ? (eventDivisions.find(d => d.division_id === selectedEvent.team_division_id)?.division_name || '미연결')
                    : '미결정'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 선택된 대회의 부서 관리 */}
      {selectedEvent && (
        <div className="bg-white rounded-r border border-line p-4">
          <h3 className="text-sm font-bold mb-1">📋 {selectedEvent.event_name} - 부서 관리</h3>

          {/* 팀전/개인전 안내 */}
          {(selectedEvent.event_type === 'team' || selectedEvent.event_type === 'both') ? (
            <p className="text-xs text-blue-600 mb-3">👥 클럽대항전 부서 — 직접 입력하세요. (예: 남성부, 여성부, 혼성부)</p>
          ) : (
            <p className="text-xs text-sub mb-3">📊 개인전 부서 — 포인트 규정 목록에서 선택하세요.</p>
          )}

          {/* 부서 추가 */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              {/* 팀전: 직접 입력 */}
              {(selectedEvent.event_type === 'team' || selectedEvent.event_type === 'both') ? (
                <input
                  type="text"
                  value={divForm.division_name}
                  onChange={e => setDivForm({ ...divForm, division_name: e.target.value })}
                  placeholder="부서명 직접 입력 (예: 남성부, 여성부)"
                  className="w-full text-sm border border-line rounded-lg px-3 py-2" />
              ) : (
                /* 개인전: 포인트 규정 드롭다운 */
                <select
                  value={divForm.division_name}
                  onChange={e => setDivForm({ ...divForm, division_name: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2">
                  <option value="">부서 선택 (포인트 규정 기준)</option>
                  {pointRuleDivisions.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}
            </div>
            <label className="flex items-center gap-1 text-xs text-sub shrink-0">
              <input type="checkbox" checked={divForm.has_groups}
                onChange={e => setDivForm({ ...divForm, has_groups: e.target.checked })} />
              조별리그
            </label>
            <button onClick={handleAddDivision}
              className="bg-accent text-white px-3 py-2 rounded-lg text-sm shrink-0">추가</button>
          </div>

          {selectedEvent.event_type === 'individual' && pointRuleDivisions.length === 0 && (
            <p className="text-xs text-amber-600 mb-3">⚠️ 포인트 규정에 부서가 없습니다. 먼저 포인트 규정에서 부서를 추가해주세요.</p>
          )}

          {/* 부서 목록 */}
          <div className="space-y-1">
            {eventDivisions.length === 0 ? (
              <p className="text-sm text-sub py-4 text-center">등록된 부서가 없습니다.</p>
            ) : eventDivisions.map(d => (
              <div key={d.division_id} className="flex items-center justify-between py-2 px-3 bg-soft rounded-lg">
                <div>
                  <span className="text-sm font-medium">{d.division_name}</span>
                  {d.has_groups && (
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                      d.groups_status === 'COMPLETED' ? 'bg-green-50 text-green-700' :
                      d.groups_status === 'IN_PROGRESS' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>{d.groups_status}</span>
                  )}
                  {selectedEvent.team_division_id === d.division_id && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">👥팀전 부서</span>
                  )}
                </div>
                <div className="flex gap-1">
                  {d.has_groups && d.groups_status !== 'COMPLETED' && (
                    <>
                      {d.groups_status === 'NONE' && (
                        <button onClick={() => updateGroupsStatus(d.division_id, 'IN_PROGRESS')}
                          className="text-xs text-yellow-600 hover:underline">조별시작</button>
                      )}
                      <button onClick={() => updateGroupsStatus(d.division_id, 'COMPLETED')}
                        className="text-xs text-green-600 hover:underline">조별완료</button>
                    </>
                  )}
                  <button onClick={() => deleteDivision(d.division_id)}
                    className="text-xs text-red-500 hover:underline">삭제</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 대회 수정 모달 */}
      {showEditModal && editingEvent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold mb-4">✏️ 대회 정보 수정</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-sub mb-1">대회명 *</label>
                <input type="text" value={editForm.event_name}
                  onChange={e => setEditForm({ ...editForm, event_name: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-sub mb-1">대회 시작일 *</label>
                  <input type="date" value={editForm.event_date}
                    onChange={e => setEditForm({ ...editForm, event_date: e.target.value })}
                    className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs text-sub mb-1">대회 종료일 <span className="text-gray-400">(2일이상)</span></label>
                  <input type="date" value={editForm.event_date_end}
                    min={editForm.event_date}
                    onChange={e => setEditForm({ ...editForm, event_date_end: e.target.value })}
                    className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-sub mb-1">참가비 (원)</label>
                  <input type="number" value={editForm.entry_fee_team}
                    onChange={e => setEditForm({ ...editForm, entry_fee_team: e.target.value })}
                    className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                </div>
              </div>

              {/* 계좌 정보 */}
              <div>
                <label className="block text-xs text-sub mb-1">💳 입금 계좌</label>
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" value={editForm.account_bank}
                    onChange={e => setEditForm({ ...editForm, account_bank: e.target.value })}
                    placeholder="은행명"
                    className="text-sm border border-line rounded-lg px-3 py-2" />
                  <input type="text" value={editForm.account_number}
                    onChange={e => setEditForm({ ...editForm, account_number: e.target.value })}
                    placeholder="계좌번호"
                    className="text-sm border border-line rounded-lg px-3 py-2" />
                  <input type="text" value={editForm.account_holder}
                    onChange={e => setEditForm({ ...editForm, account_holder: e.target.value })}
                    placeholder="예금주"
                    className="text-sm border border-line rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-sub mb-1">신청 시작</label>
                <input type="datetime-local" value={editForm.entry_open_at}
                  onChange={e => setEditForm({ ...editForm, entry_open_at: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs text-sub mb-1">신청 마감</label>
                <input type="datetime-local" value={editForm.entry_close_at}
                  onChange={e => setEditForm({ ...editForm, entry_close_at: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs text-sub mb-1">연결 대회 마스터</label>
                <select value={editForm.tournament_id}
                  onChange={e => setEditForm({ ...editForm, tournament_id: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2">
                  <option value="">없음</option>
                  {tournaments.map(t => (
                    <option key={t.tournament_id} value={t.tournament_id}>{t.tournament_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-sub mb-1">설명</label>
                <textarea value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowEditModal(false); setEditingEvent(null) }}
                className="flex-1 py-2 border border-line rounded-lg text-sm text-sub">취소</button>
              <button onClick={handleUpdateEvent}
                className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}