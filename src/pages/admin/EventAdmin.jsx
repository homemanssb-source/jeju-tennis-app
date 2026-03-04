import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function EventAdmin() {
  const showToast = useContext(ToastContext)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    event_name: '', event_date: '', entry_fee_team: '',
    entry_open_at: '', entry_close_at: '', description: '', tournament_id: '',
    event_type: 'individual', team_match_type: '3_doubles', team_division_id: '',
  })
  const [tournaments, setTournaments] = useState([])

  // 부서 관리
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventDivisions, setEventDivisions] = useState([])
  const [divForm, setDivForm] = useState({ division_name: '', has_groups: false })

  // 편집 모드
  const [editingEvent, setEditingEvent] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: evts }, { data: tours }] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: false }),
      supabase.from('tournaments_master').select('*').order('date', { ascending: false }),
    ])
    setEvents(evts || [])
    setTournaments(tours || [])
    setLoading(false)
  }

  async function fetchDivisions(eventId) {
    const { data } = await supabase.from('event_divisions')
      .select('*').eq('event_id', eventId).order('division_name')
    setEventDivisions(data || [])
    return data || []
  }

  async function handleAddEvent() {
    if (!form.event_name || !form.event_date) {
      showToast?.('대회명과 날짜는 필수입니다.', 'error'); return
    }
    // 단체전인데 부서 미선택 체크
    if ((form.event_type === 'team' || form.event_type === 'both') && !form.team_division_id) {
      // 부서가 아직 없을 수 있으므로 경고만
    }
    const insertData = {
      event_name: form.event_name,
      event_date: form.event_date,
      entry_fee_team: form.entry_fee_team ? Number(form.entry_fee_team) : 0,
      entry_open_at: form.entry_open_at || null,
      entry_close_at: form.entry_close_at || null,
      tournament_id: form.tournament_id || null,
      description: form.description || null,
      event_type: form.event_type,
      team_match_type: (form.event_type === 'team' || form.event_type === 'both') ? form.team_match_type : null,
      team_division_id: (form.event_type === 'team' || form.event_type === 'both') ? (form.team_division_id || null) : null,
    }
    const { error } = await supabase.from('events').insert([insertData])
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.('대회가 생성되었습니다.')
    setShowForm(false)
    setForm({
      event_name: '', event_date: '', entry_fee_team: '', entry_open_at: '', entry_close_at: '',
      description: '', tournament_id: '', event_type: 'individual', team_match_type: '3_doubles', team_division_id: '',
    })
    fetchAll()
  }

  async function toggleEventStatus(ev) {
    const newStatus = ev.status === 'OPEN' ? 'CLOSED' : 'OPEN'
    await supabase.from('events').update({ status: newStatus }).eq('event_id', ev.event_id)
    showToast?.(`${ev.event_name} → ${newStatus}`)
    fetchAll()
  }

  // ★ 대회 삭제 (연관 데이터 모두 삭제)
  async function handleDeleteEvent(ev) {
    const confirmMsg = `⚠️ "${ev.event_name}" 대회를 삭제하시겠습니까?\n\n` +
      `다음 데이터가 모두 삭제됩니다:\n` +
      `- 개인전 참가신청 및 결제내역\n` +
      `- 단체전 참가신청 및 선수명단\n` +
      `- 부서 정보\n` +
      `- 앱B 경기결과\n\n` +
      `이 작업은 되돌릴 수 없습니다.`
    if (!confirm(confirmMsg)) return

    try {
      const eid = ev.event_id

      // 1. team_event_members (team_event_entries의 하위)
      const { data: teamEntries } = await supabase.from('team_event_entries').select('id').eq('event_id', eid)
      if (teamEntries?.length > 0) {
        const entryIds = teamEntries.map(e => e.id)
        await supabase.from('team_event_members').delete().in('entry_id', entryIds)
      }

      // 2. team_event_entries
      await supabase.from('team_event_entries').delete().eq('event_id', eid)

      // 3. payments (target_event_id 또는 matched_entry_id)
      await supabase.from('payments').delete().eq('target_event_id', eid)

      // 4. event_entries
      await supabase.from('event_entries').delete().eq('event_id', eid)

      // 5. app_b_match_results
      await supabase.from('app_b_match_results').delete().eq('event_id', eid)

      // 6. event_divisions
      await supabase.from('event_divisions').delete().eq('event_id', eid)

      // 7. events
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

  // 단체전 설정 수정 (선택된 대회)
  async function handleUpdateTeamSettings() {
    if (!editingEvent) return
    const updates = {
      event_type: editingEvent.event_type,
      team_match_type: (editingEvent.event_type === 'team' || editingEvent.event_type === 'both')
        ? editingEvent.team_match_type : null,
      team_division_id: (editingEvent.event_type === 'team' || editingEvent.event_type === 'both')
        ? (editingEvent.team_division_id || null) : null,
    }
    const { error } = await supabase.from('events').update(updates).eq('event_id', editingEvent.event_id)
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.('단체전 설정이 저장되었습니다.')
    setEditingEvent(null)
    fetchAll()
  }

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
    showToast?.('예선 상태 변경: ' + status)
    if (selectedEvent) fetchDivisions(selectedEvent.event_id)
  }

  function getEventTypeBadge(ev) {
    if (ev.event_type === 'team') return { label: '단체', color: 'bg-blue-50 text-blue-700' }
    if (ev.event_type === 'both') return { label: '개인+단체', color: 'bg-purple-50 text-purple-700' }
    return { label: '개인', color: 'bg-gray-100 text-gray-600' }
  }

  function getMatchTypeLabel(type) {
    if (type === '5_doubles') return '5복식'
    if (type === '3_doubles') return '3복식'
    return '-'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">🎫 대회(이벤트) 관리</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + 대회 생성
        </button>
      </div>

      {/* 대회 생성 폼 */}
      {showForm && (
        <div className="bg-white rounded-r border border-line p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-sub mb-1">대회명 *</label>
              <input type="text" value={form.event_name}
                onChange={e => setForm({ ...form, event_name: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">대회일 *</label>
              <input type="date" value={form.event_date}
                onChange={e => setForm({ ...form, event_date: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">참가비 (원/팀)</label>
              <input type="number" value={form.entry_fee_team}
                onChange={e => setForm({ ...form, entry_fee_team: e.target.value })}
                placeholder="0"
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>

            {/* 대회 유형 선택 */}
            <div className="col-span-2">
              <label className="block text-xs text-sub mb-1">대회 유형 *</label>
              <div className="flex gap-2">
                {[
                  { value: 'individual', label: '🏸 개인전', desc: '개인/복식 경기' },
                  { value: 'team', label: '🏟️ 단체전', desc: '클럽 대항전' },
                  { value: 'both', label: '🏸+🏟️ 개인+단체', desc: '둘 다 운영' },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm({ ...form, event_type: opt.value })}
                    className={`flex-1 p-3 rounded-lg border text-left transition-colors ${
                      form.event_type === opt.value
                        ? 'border-accent bg-accentSoft'
                        : 'border-line hover:bg-soft'
                    }`}>
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-sub mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 단체전 옵션 */}
            {(form.event_type === 'team' || form.event_type === 'both') && (
              <>
                <div>
                  <label className="block text-xs text-sub mb-1">경기 방식 *</label>
                  <select value={form.team_match_type}
                    onChange={e => setForm({ ...form, team_match_type: e.target.value })}
                    className="w-full text-sm border border-line rounded-lg px-3 py-2">
                    <option value="3_doubles">3복식 (2승 선승제)</option>
                    <option value="5_doubles">5복식 (3승 선승제)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-sub mb-1">단체전 참가부서</label>
                  <p className="text-xs text-sub py-2">대회 생성 후 부서를 추가하고 연결하세요</p>
                </div>
              </>
            )}

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
              <th className="px-3 py-2 text-center text-sub font-medium">유형</th>
              <th className="px-3 py-2 text-center text-sub font-medium">경기방식</th>
              <th className="px-3 py-2 text-center text-sub font-medium">상태</th>
              <th className="px-3 py-2 text-center text-sub font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-sub">로딩 중...</td></tr>
            ) : events.map(ev => {
              const badge = getEventTypeBadge(ev)
              return (
                <tr key={ev.event_id} className={`border-t border-line hover:bg-soft cursor-pointer
                  ${selectedEvent?.event_id === ev.event_id ? 'bg-accentSoft' : ''}`}
                  onClick={() => { setSelectedEvent(ev); fetchDivisions(ev.event_id); setEditingEvent(null) }}>
                  <td className="px-3 py-2 font-medium">{ev.event_name}</td>
                  <td className="px-3 py-2 text-sub">{ev.event_date}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-sub">
                    {(ev.event_type === 'team' || ev.event_type === 'both') ? getMatchTypeLabel(ev.team_match_type) : '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      ev.status === 'OPEN' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>{ev.status}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={(e) => { e.stopPropagation(); toggleEventStatus(ev) }}
                        className="text-xs text-accent hover:underline">
                        {ev.status === 'OPEN' ? '마감' : '오픈'}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev) }}
                        className="text-xs text-red-500 hover:underline">
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 선택된 대회의 단체전 설정 */}
      {selectedEvent && (selectedEvent.event_type === 'team' || selectedEvent.event_type === 'both') && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-blue-800">🏟️ 단체전 설정</h3>
            {!editingEvent ? (
              <button onClick={() => setEditingEvent({ ...selectedEvent })}
                className="text-xs text-blue-600 hover:underline">수정</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleUpdateTeamSettings}
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded">저장</button>
                <button onClick={() => setEditingEvent(null)}
                  className="text-xs text-sub">취소</button>
              </div>
            )}
          </div>

          {editingEvent ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-blue-700 mb-1">대회 유형</label>
                  <select value={editingEvent.event_type}
                    onChange={e => setEditingEvent({ ...editingEvent, event_type: e.target.value })}
                    className="w-full text-sm border border-blue-200 rounded-lg px-3 py-2">
                    <option value="individual">개인전</option>
                    <option value="team">단체전</option>
                    <option value="both">개인+단체</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-blue-700 mb-1">경기 방식</label>
                  <select value={editingEvent.team_match_type || '3_doubles'}
                    onChange={e => setEditingEvent({ ...editingEvent, team_match_type: e.target.value })}
                    className="w-full text-sm border border-blue-200 rounded-lg px-3 py-2">
                    <option value="3_doubles">3복식 (2승 선승제)</option>
                    <option value="5_doubles">5복식 (3승 선승제)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-blue-700 mb-1">단체전 참가부서</label>
                  <select value={editingEvent.team_division_id || ''}
                    onChange={e => setEditingEvent({ ...editingEvent, team_division_id: e.target.value || null })}
                    className="w-full text-sm border border-blue-200 rounded-lg px-3 py-2">
                    <option value="">미지정</option>
                    {eventDivisions.map(d => (
                      <option key={d.division_id} value={d.division_id}>{d.division_name}</option>
                    ))}
                  </select>
                  {eventDivisions.length === 0 && (
                    <p className="text-xs text-blue-600 mt-1">아래에서 부서를 먼저 추가하세요</p>
                  )}
                </div>
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
                    ? (eventDivisions.find(d => d.division_id === selectedEvent.team_division_id)?.division_name || '연결됨')
                    : '미지정'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 선택된 대회의 부서 관리 */}
      {selectedEvent && (
        <div className="bg-white rounded-r border border-line p-4">
          <h3 className="text-sm font-bold mb-3">📂 {selectedEvent.event_name} - 부서 관리</h3>

          {/* 부서 추가 */}
          <div className="flex gap-2 mb-3">
            <input type="text" value={divForm.division_name}
              onChange={e => setDivForm({ ...divForm, division_name: e.target.value })}
              placeholder="부서명 입력..."
              className="flex-1 text-sm border border-line rounded-lg px-3 py-2" />
            <label className="flex items-center gap-1 text-xs text-sub shrink-0">
              <input type="checkbox" checked={divForm.has_groups}
                onChange={e => setDivForm({ ...divForm, has_groups: e.target.checked })} />
              조별예선
            </label>
            <button onClick={handleAddDivision}
              className="bg-accent text-white px-3 py-2 rounded-lg text-sm shrink-0">추가</button>
          </div>

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
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">🏟️ 단체전</span>
                  )}
                </div>
                <div className="flex gap-1">
                  {d.has_groups && d.groups_status !== 'COMPLETED' && (
                    <>
                      {d.groups_status === 'NONE' && (
                        <button onClick={() => updateGroupsStatus(d.division_id, 'IN_PROGRESS')}
                          className="text-xs text-yellow-600 hover:underline">예선시작</button>
                      )}
                      <button onClick={() => updateGroupsStatus(d.division_id, 'COMPLETED')}
                        className="text-xs text-green-600 hover:underline">예선완료</button>
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
    </div>
  )
}