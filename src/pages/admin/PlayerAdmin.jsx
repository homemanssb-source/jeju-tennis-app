// src/pages/admin/PlayerAdmin.jsx — 선수(member_type='선수') 전용 관리
// - 보호자 연락처(guardian_phone) 관리, 선수 본인 연락처는 선택
// - 생년월일 기준 연령부서 자동 편성 (기준연도 선택 가능)
// - 선수는 등록비 면제 — 등록 즉시 활성
import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'
import { AGE_GROUPS, ageGroupOf, fullAge } from '../../lib/ageGroups'

const EMPTY = {
  member_id: '', name: '', display_name: '', gender: '', birthdate: '',
  phone: '', guardian_phone: '', club: '', status: '활성',
}

const normPhone = p => (p || '').replace(/[^0-9]/g, '')

function fmtPhone(p) {
  if (!p) return '-'
  return normPhone(p).replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3')
}

export default function PlayerAdmin() {
  const showToast = useContext(ToastContext)
  const thisYear = new Date().getFullYear()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClub, setFilterClub] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [baseYear, setBaseYear] = useState(thisYear)
  const [clubs, setClubs] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [modal, setModal] = useState(null)      // 'add' | 'edit'
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY)

  useEffect(() => { fetchPlayers() }, [])

  async function fetchPlayers() {
    setLoading(true)
    const { data, error } = await supabase.from('members')
      .select('*')
      .eq('member_type', '선수')
      .order('name')
    if (error) showToast?.('불러오기 실패: ' + error.message, 'error')
    if (data) {
      setPlayers(data)
      setClubs([...new Set(data.map(p => p.club).filter(Boolean))].sort())
    }
    setLoading(false)
  }

  const groupOf = p => ageGroupOf(p.birthdate, baseYear)

  const filtered = players.filter(p => {
    if (filterStatus && p.status !== filterStatus) return false
    if (filterClub && p.club !== filterClub) return false
    if (filterGroup && (groupOf(p) || '미정') !== filterGroup) return false
    if (search) {
      const q = search.toLowerCase()
      const qDigits = q.replace(/[^0-9]/g, '')
      return (p.name || '').toLowerCase().includes(q) ||
        (p.display_name || '').toLowerCase().includes(q) ||
        (p.member_id || '').toLowerCase().includes(q) ||
        (p.club || '').toLowerCase().includes(q) ||
        (qDigits && ((p.phone || '').includes(qDigits) || (p.guardian_phone || '').includes(qDigits)))
    }
    return true
  })

  // 연령부서별 인원 (삭제 제외)
  const groupCounts = {}
  players.filter(p => p.status !== '삭제').forEach(p => {
    const g = groupOf(p) || '미정'
    groupCounts[g] = (groupCounts[g] || 0) + 1
  })

  function toggleSelect(id) {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }
  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(p => p.member_id)))
  }

  async function batchUpdateStatus(newStatus) {
    if (selected.size === 0) { showToast?.('선수를 선택해주세요.', 'error'); return }
    const label = newStatus === '활성' ? '활성화' : '휴면 처리'
    if (!confirm(`선택한 ${selected.size}명을 ${label}하시겠습니까?`)) return
    const ids = [...selected]
    const { error } = await supabase.from('members')
      .update({ status: newStatus })
      .in('member_id', ids)
    if (error) showToast?.('처리 실패: ' + error.message, 'error')
    else showToast?.(`${ids.length}명 ${label} 완료!`)
    setSelected(new Set())
    fetchPlayers()
  }

  function openAdd() {
    setForm({ ...EMPTY, member_id: 'M' + Date.now().toString().slice(-8) })
    setEditTarget(null)
    setModal('add')
  }
  function openEdit(p) {
    setForm({
      member_id: p.member_id, name: p.name || '', display_name: p.display_name || '',
      gender: p.gender || '', birthdate: p.birthdate || '', phone: p.phone || '',
      guardian_phone: p.guardian_phone || '', club: p.club || '', status: p.status || '활성',
    })
    setEditTarget(p)
    setModal('edit')
  }

  async function handleSave() {
    if (!form.member_id || !form.name) { showToast?.('회원ID와 이름은 필수입니다.', 'error'); return }
    if (!form.birthdate) { showToast?.('생년월일은 필수입니다.', 'error'); return }
    const phone = normPhone(form.phone)
    const guardian = normPhone(form.guardian_phone)
    if (!phone && !guardian) { showToast?.('본인 또는 보호자 연락처 중 하나는 필요합니다.', 'error'); return }
    const payload = {
      name: form.name,
      display_name: form.display_name || form.name,
      name_norm: form.name.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase(),
      gender: form.gender || null,
      birthdate: form.birthdate,
      phone: phone || null,
      guardian_phone: guardian || null,
      club: form.club || null,
      status: form.status,
      member_type: '선수',
    }
    if (modal === 'add') {
      const { error } = await supabase.from('members').insert([{
        ...payload,
        member_id: form.member_id,
        division: null, grade: null, grade_source: 'auto',
        pin_code: (phone || guardian).slice(-6),
        registered_at: new Date().toISOString(),
      }])
      if (error) {
        showToast?.(error.code === '23505' ? '이미 등록된 전화번호입니다.' : '추가 실패: ' + error.message, 'error')
        return
      }
      showToast?.('선수가 추가되었습니다.')
    } else {
      const { error } = await supabase.from('members').update(payload).eq('member_id', editTarget.member_id)
      if (error) { showToast?.('수정 실패: ' + error.message, 'error'); return }
      showToast?.('선수 정보가 수정되었습니다.')
    }
    setModal(null)
    fetchPlayers()
  }

  async function handleDelete(p) {
    if (!confirm(`${p.name} 선수를 삭제 처리하시겠습니까?`)) return
    await supabase.from('members').update({ status: '삭제' }).eq('member_id', p.member_id)
    showToast?.('삭제 처리되었습니다.')
    fetchPlayers()
  }

  const counts = {
    total: players.filter(p => p.status !== '삭제').length,
    active: players.filter(p => p.status === '활성').length,
    dormant: players.filter(p => p.status === '휴면').length,
  }
  const yearOptions = [thisYear - 1, thisYear, thisYear + 1]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">🏅 선수 관리</h2>
          <p className="text-xs text-sub mt-0.5">
            전체 {counts.total}명 · 활성 {counts.active} · 대기(휴면) {counts.dormant}
          </p>
        </div>
        <button onClick={openAdd}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + 선수 추가
        </button>
      </div>

      {/* 연령부서 자동 편성 요약 */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-amber-800">📊 연령부서 자동 편성</span>
          <span className="text-xs text-amber-700">기준연도</span>
          <select value={baseYear} onChange={e => setBaseYear(Number(e.target.value))}
            className="text-xs border border-amber-300 rounded px-2 py-1 bg-white">
            {yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <span className="text-[11px] text-amber-600">(연 나이 = 기준연도 − 출생연도)</span>
        </div>
        <div className="flex gap-1.5 flex-wrap mt-2">
          {[...AGE_GROUPS.map(g => g.label), '미정'].map(label => {
            const n = groupCounts[label] || 0
            const active = filterGroup === label
            return (
              <button key={label} type="button"
                onClick={() => setFilterGroup(active ? '' : label)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  active ? 'bg-amber-600 text-white border-amber-600'
                  : n > 0 ? 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100'
                  : 'bg-white text-gray-400 border-gray-200'}`}>
                {label} <b>{n}</b>
              </button>
            )
          })}
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="이름/소속/연락처 검색..."
          className="flex-1 min-w-[120px] text-sm border border-line rounded-lg px-3 py-2" />
        <select value={filterClub} onChange={e => setFilterClub(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">전체 소속</option>
          {clubs.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">전체 상태</option>
          <option value="활성">활성</option>
          <option value="휴면">휴면(대기)</option>
          <option value="삭제">삭제</option>
        </select>
      </div>

      {/* 일괄 처리 */}
      {selected.size > 0 && (
        <div className="flex gap-2 mb-3 items-center bg-blue-50 p-2 rounded-lg">
          <span className="text-sm font-medium text-accent">{selected.size}명 선택</span>
          <button onClick={() => batchUpdateStatus('활성')}
            className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700">
            ✅ 일괄 활성화
          </button>
          <button onClick={() => batchUpdateStatus('휴면')}
            className="bg-yellow-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-yellow-600">
            ⏸️ 일괄 휴면
          </button>
          <button onClick={() => setSelected(new Set())}
            className="text-xs text-sub hover:underline ml-auto">선택 해제</button>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-lg border border-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-soft2">
            <tr>
              <th className="px-2 py-2 text-center w-8">
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll} className="rounded" />
              </th>
              <th className="px-3 py-2 text-left font-medium text-sub">이름</th>
              <th className="px-3 py-2 text-left font-medium text-sub">성별</th>
              <th className="px-3 py-2 text-left font-medium text-sub">생년월일</th>
              <th className="px-3 py-2 text-left font-medium text-sub">연령부서</th>
              <th className="px-3 py-2 text-left font-medium text-sub">소속</th>
              <th className="px-3 py-2 text-left font-medium text-sub">연락처 (본인 / 보호자)</th>
              <th className="px-3 py-2 text-left font-medium text-sub">상태</th>
              <th className="px-3 py-2 text-center font-medium text-sub">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-8 text-sub">로딩 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-sub">
                {players.length === 0 ? '등록된 선수가 없습니다.' : '결과 없음'}
              </td></tr>
            ) : filtered.map(p => {
              const age = fullAge(p.birthdate)
              const group = groupOf(p)
              return (
                <tr key={p.member_id} className={`border-t border-line hover:bg-soft ${selected.has(p.member_id) ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" checked={selected.has(p.member_id)}
                      onChange={() => toggleSelect(p.member_id)} className="rounded" />
                  </td>
                  <td className="px-3 py-2 font-medium">{p.display_name || p.name}</td>
                  <td className="px-3 py-2 text-sub">{p.gender || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.birthdate || '-'}
                    {age !== null && <span className="ml-1 text-xs text-sub">(만 {age}세)</span>}
                  </td>
                  <td className="px-3 py-2">
                    {group
                      ? <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-xs rounded whitespace-nowrap">{group}</span>
                      : <span className="text-xs text-gray-400">미정</span>}
                  </td>
                  <td className="px-3 py-2 text-sub">{p.club || '-'}</td>
                  <td className="px-3 py-2 text-sub font-mono text-xs whitespace-nowrap">
                    {fmtPhone(p.phone)} / {fmtPhone(p.guardian_phone)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      p.status === '활성' ? 'bg-green-50 text-green-700' :
                      p.status === '휴면' ? 'bg-yellow-50 text-yellow-700' :
                      p.status === '삭제' ? 'bg-red-50 text-red-500' :
                      'bg-gray-100 text-gray-500'
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => openEdit(p)} className="text-xs text-accent hover:underline">수정</button>
                      {p.status !== '삭제' && (
                        <button onClick={() => handleDelete(p)} className="text-xs text-red-500 hover:underline">삭제</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-sub mt-2">총 {filtered.length}명</p>

      {/* 추가/수정 모달 */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold mb-4">{modal === 'add' ? '선수 추가' : '선수 수정'}</h3>
            <div className="space-y-3">
              {[
                { key: 'member_id', label: '회원 ID', disabled: modal === 'edit' },
                { key: 'name', label: '이름 *' },
                { key: 'display_name', label: '표시명' },
                { key: 'guardian_phone', label: '보호자 연락처' },
                { key: 'phone', label: '선수 본인 연락처 (선택)' },
                { key: 'club', label: '소속 (학교 · 클럽 · 팀)' },
              ].map(({ key, label, disabled }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-sub mb-1">{label}</label>
                  <input type="text" value={form[key] || ''}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    disabled={disabled}
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 disabled:bg-soft2" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-sub mb-1">생년월일 *</label>
                <input type="date" value={form.birthdate || ''}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setForm({ ...form, birthdate: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                {form.birthdate && (
                  <p className="text-xs text-amber-700 mt-1">
                    → {baseYear}년 기준 <b>{ageGroupOf(form.birthdate, baseYear) || '미정'}</b>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-sub mb-1">성별</label>
                <select value={form.gender || ''} onChange={e => setForm({ ...form, gender: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2">
                  <option value="">선택</option>
                  <option value="남">남</option>
                  <option value="여">여</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-sub mb-1">상태</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2">
                  <option value="활성">활성</option>
                  <option value="휴면">휴면(대기)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2 border border-line rounded-lg text-sm text-sub hover:bg-soft2">취소</button>
              <button onClick={handleSave}
                className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-700">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
