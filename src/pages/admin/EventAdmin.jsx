import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

const EVENT_TYPE_LABELS = {
  individual: '🎾 개인전',
  team: '🏟️ 단체전',
  both: '🎾+🏟️ 개인+단체 통합',
}

export default function EventAdmin() {
  const showToast = useContext(ToastContext)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    event_name: '', event_date: '', entry_fee_team: '',
    entry_open_at: '', entry_close_at: '', description: '', tournament_id: '',
    event_type: 'individual', team_member_limit: '',
  })
  const [tournaments, setTournaments] = useState([])

  // 부서 관리
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventDivisions, setEventDivisions] = useState([])
  const [divForm, setDivForm] = useState({ division_name: '', has_groups: false })

  // 앱B 연동
  const [syncing, setSyncing] = useState(false)

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
  }

  async function handleAddEvent() {
    if (!form.event_name || !form.event_date) {
      showToast?.('대회명과 날짜는 필수입니다.', 'error'); return
    }
    const insertData = {
      ...form,
      entry_fee_team: form.entry_fee_team ? Number(form.entry_fee_team) : 0,
      entry_open_at: form.entry_open_at || null,
      entry_close_at: form.entry_close_at || null,
      tournament_id: form.tournament_id || null,
      team_member_limit: form.team_member_limit ? Number(form.team_member_limit) : null,
    }
    const { error } = await supabase.from('events').insert([insertData])
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.('대회가 생성되었습니다.')
    setShowForm(false)
    setForm({
      event_name: '', event_date: '', entry_fee_team: '',
      entry_open_at: '', entry_close_at: '', description: '', tournament_id: '',
      event_type: 'individual', team_member_limit: '',
    })
    fetchAll()
  }

  async function toggleEventStatus(ev) {
    const newStatus = ev.status === 'OPEN' ? 'CLOSED' : 'OPEN'
    await supabase.from('events').update({ status: newStatus }).eq('event_id', ev.event_id)
    showToast?.(`${ev.event_name} → ${newStatus}`)
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

  // ── 앱B 연동 ──
  async function handleSyncToAppB(ev) {
    if (!confirm(`"${ev.event_name}" 단체전 데이터를 앱B로 전송합니다.\n계속하시겠습니까?`)) return
    setSyncing(true)
    try {
      // 앱B API 호출
      const APP_B_URL = 'https://jeju-tournament.vercel.app'  // ← 앱B 배포 URL로 변경 필요
      const res = await fetch(`${APP_B_URL}/api/sync/pull-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: ev.event_id,        // 앱B에서 사용할 event_id (나중에 매핑)
          app_a_event_id: ev.event_id,   // 앱A의 event_id
        }),
      })
      const result = await res.json()

      if (result.success) {
        // 앱A 동기화 상태 업데이트
        await supabase.from('events').update({
          app_b_synced: true,
          app_b_synced_at: new Date().toISOString(),
        }).eq('event_id', ev.event_id)

        showToast?.(`✅ 앱B 전송 완료! ${result.synced}팀 동기화, ${result.skipped || 0}팀 스킵`)
        fetchAll()
      } else {
        showToast?.('❌ 전송 실패: ' + (result.error || '알 수 없는 오류'), 'error')
      }
    } catch (err) {
      showToast?.('❌ 연결 실패: 앱B 서버에 접근할 수 없습니다.', 'error')
    } finally {
      setSyncing(false)
    }
  }

  // 단체전/통합 대회인지 확인
  function isTeamEvent(ev) {
    return ev.event_type === 'team' || ev.event_type === 'both'
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

            {/* ★ 대회 유형 선택 (신규) */}
            <div className="col-span-2">
              <label className="block text-xs text-sub mb-1">대회 유형 *</label>
              <div className="flex gap-2">
                {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                  <button key={key}
                    onClick={() => setForm({ ...form, event_type: key })}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                      form.event_type === key
                        ? 'border-accent bg-accentSoft text-accent'
                        : 'border-line bg-white text-sub hover:border-gray-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
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

            {/* ★ 단체전일 때만 인원 제한 표시 */}
            {(form.event_type === 'team' || form.event_type === 'both') && (
              <div>
                <label className="block text-xs text-sub mb-1">클럽 인원 제한</label>
                <select value={form.team_member_limit}
                  onChange={e => setForm({ ...form, team_member_limit: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2">
                  <option value="">무제한</option>
                  <option value="8">8명</option>
                  <option value="10">10명</option>
                  <option value="12">12명</option>
                  <option value="15">15명</option>
                  <option value="20">20명</option>
                </select>
              </div>
            )}

            <div className={form.event_type === 'team' || form.event_type === 'both' ? '' : 'col-span-2'}>
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
              <th className="px-3 py-2 text-left text-sub font-medium">유형</th>
              <th className="px-3 py-2 text-left text-sub font-medium">날짜</th>
              <th className="px-3 py-2 text-right text-sub font-medium">참가비</th>
              <th className="px-3 py-2 text-center text-sub font-medium">상태</th>
              <th className="px-3 py-2 text-center text-sub font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-sub">로딩 중...</td></tr>
            ) : events.map(ev => (
              <tr key={ev.event_id} className={`border-t border-line hover:bg-soft cursor-pointer
                ${selectedEvent?.event_id === ev.event_id ? 'bg-accentSoft' : ''}`}
                onClick={() => { setSelectedEvent(ev); fetchDivisions(ev.event_id) }}>
                <td className="px-3 py-2 font-medium">{ev.event_name}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    ev.event_type === 'team' ? 'bg-green-50 text-green-700' :
                    ev.event_type === 'both' ? 'bg-purple-50 text-purple-700' :
                    'bg-blue-50 text-blue-700'
                  }`}>
                    {EVENT_TYPE_LABELS[ev.event_type] || '🎾 개인전'}
                  </span>
                </td>
                <td className="px-3 py-2 text-sub">{ev.event_date}</td>
                <td className="px-3 py-2 text-right">{ev.entry_fee_team?.toLocaleString() || 0}원</td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    ev.status === 'OPEN' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>{ev.status}</span>
                </td>
                <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => toggleEventStatus(ev)}
                      className="text-xs text-accent hover:underline">
                      {ev.status === 'OPEN' ? '마감' : '오픈'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 선택된 대회의 부서 관리 + 앱B 연동 */}
      {selectedEvent && (
        <div className="space-y-4">
          {/* ★ 앱B 연동 패널 (단체전/통합일 때만) */}
          {isTeamEvent(selectedEvent) && (
            <div className={`rounded-r border p-4 ${
              selectedEvent.app_b_synced
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">
                    🔗 앱B (대회 운영) 연동
                  </h3>
                  {selectedEvent.app_b_synced ? (
                    <p className="text-xs text-green-700 mt-1">
                      ✅ 전송됨 · {selectedEvent.app_b_synced_at
                        ? new Date(selectedEvent.app_b_synced_at).toLocaleString('ko-KR')
                        : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-yellow-700 mt-1">
                      아직 앱B로 전송되지 않았습니다.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleSyncToAppB(selectedEvent)}
                  disabled={syncing}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap disabled:opacity-50 ${
                    selectedEvent.app_b_synced
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-accent text-white hover:bg-blue-700'
                  }`}>
                  {syncing ? '전송중...' : selectedEvent.app_b_synced ? '🔄 재전송' : '📤 앱B로 전송'}
                </button>
              </div>
            </div>
          )}

          {/* 부서 관리 (개인전/통합일 때) */}
          {(selectedEvent.event_type !== 'team') && (
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
      )}
    </div>
  )
}
