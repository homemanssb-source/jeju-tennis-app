import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function MemberAdmin() {
  const showToast = useContext(ToastContext)
  const [members, setMembers] = useState([])
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMembership, setFilterMembership] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [membershipModal, setMembershipModal] = useState(null)
  const [membershipForm, setMembershipForm] = useState({ status: '', until: '', reason: '' })
  const [form, setForm] = useState({
    member_id: '', name: '', display_name: '', gender: '',
    phone: '', club: '', division: '', grade: '', status: '활성',
  })

  useEffect(() => { fetchMembers(); fetchGrades() }, [])

  async function fetchMembers() {
    setLoading(true)
    const { data } = await supabase.from('members').select('*').neq('status', '삭제').order('name')
    setMembers(data || [])
    setLoading(false)
  }

  async function fetchGrades() {
    const { data } = await supabase.rpc('get_grade_options')
    if (data) setGrades(data.map(d => d.grade_value))
  }

  function filtered() {
    let list = members
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(m => (m.name || '').toLowerCase().includes(q) || (m.member_id || '').toLowerCase().includes(q) || (m.club || '').toLowerCase().includes(q))
    }
    if (filterStatus) list = list.filter(m => m.status === filterStatus)
    if (filterMembership === 'valid') list = list.filter(m => m.membership_paid_until && new Date(m.membership_paid_until) >= new Date())
    else if (filterMembership === 'expired') list = list.filter(m => !m.membership_paid_until || new Date(m.membership_paid_until) < new Date())
    return list
  }

  function isMembershipValid(m) { return m.membership_paid_until && new Date(m.membership_paid_until) >= new Date() }

  function startEdit(m) {
    setEditMember(m)
    setForm({ member_id: m.member_id, name: m.name || '', display_name: m.display_name || '', gender: m.gender || '',
      phone: m.phone || '', club: m.club || '', division: m.division || '', grade: m.grade || '', status: m.status || '활성' })
    setShowForm(true)
  }

  function startAdd() {
    setEditMember(null)
    setForm({ member_id: 'M' + Date.now().toString().slice(-8), name: '', display_name: '', gender: '',
      phone: '', club: '', division: '', grade: '', status: '활성' })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name || !form.member_id) { showToast?.('이름과 회원ID는 필수입니다.', 'error'); return }
    const data = { ...form, display_name: form.display_name || form.name,
      name_norm: form.name.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase() }

    if (editMember) {
      if (editMember.grade !== form.grade && form.grade) {
        await supabase.rpc('admin_set_member_grade', { p_member_id: form.member_id, p_new_grade: form.grade, p_reason: '관리자 수동 수정', p_entered_by: 'admin' })
        delete data.grade; delete data.before_grade; delete data.grade_changed_at; delete data.grade_source
      }
      const { error } = await supabase.from('members').update(data).eq('member_id', form.member_id)
      if (error) { showToast?.(error.message, 'error'); return }
      showToast?.('회원 정보 수정 완료')
    } else {
      const { error } = await supabase.from('members').insert([data])
      if (error) { showToast?.(error.message, 'error'); return }
      showToast?.('회원 추가 완료')
    }
    setShowForm(false); fetchMembers()
  }

  async function handleDelete(m) {
    if (!confirm(`${m.name} 회원을 삭제(비활성)하시겠습니까?`)) return
    await supabase.from('members').update({ status: '삭제' }).eq('member_id', m.member_id)
    showToast?.('삭제됨'); fetchMembers()
  }

  function openMembershipModal(m) {
    setMembershipModal(m)
    setMembershipForm({ status: m.status || '활성', until: m.membership_paid_until || new Date().getFullYear() + '-12-31', reason: '' })
  }

  async function handleMembershipSave() {
    if (!membershipModal || !membershipForm.reason) { showToast?.('변경 사유를 입력해주세요.', 'error'); return }
    const { data, error } = await supabase.rpc('admin_set_membership', {
      p_member_id: membershipModal.member_id, p_status: membershipForm.status,
      p_until: membershipForm.until || null, p_reason: membershipForm.reason, p_entered_by: 'admin'
    })
    if (error || !data?.ok) { showToast?.(data?.message || error?.message || '변경 실패', 'error'); return }
    showToast?.('등록 상태 변경 완료'); setMembershipModal(null); fetchMembers()
  }

  const list = filtered()
  const totalActive = members.filter(m => m.status === '활성').length
  const totalDormant = members.filter(m => m.status === '휴면').length
  const totalMembershipValid = members.filter(m => isMembershipValid(m)).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">👥 회원 관리</h2>
        <button onClick={startAdd} className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ 회원 추가</button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="bg-accent text-white px-3 py-2 rounded-lg"><p className="text-[10px] opacity-80">전체</p><p className="text-lg font-bold">{members.length}</p></div>
        <div className="bg-green-50 text-green-700 px-3 py-2 rounded-lg"><p className="text-[10px]">활성</p><p className="text-lg font-bold">{totalActive}</p></div>
        <div className="bg-yellow-50 text-yellow-700 px-3 py-2 rounded-lg"><p className="text-[10px]">휴면</p><p className="text-lg font-bold">{totalDormant}</p></div>
        <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg"><p className="text-[10px]">등록비 유효</p><p className="text-lg font-bold">{totalMembershipValid}</p></div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="이름/ID/클럽 검색..."
          className="flex-1 min-w-[150px] text-sm border border-line rounded-lg px-3 py-2" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">전체 상태</option><option value="활성">활성</option><option value="휴면">휴면</option>
        </select>
        <select value={filterMembership} onChange={e => setFilterMembership(e.target.value)} className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">전체 등록비</option><option value="valid">등록비 유효</option><option value="expired">등록비 만료/미납</option>
        </select>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-line p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold">{editMember ? '회원 수정' : '회원 추가'}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label className="block text-xs text-sub mb-1">회원 ID</label>
              <input type="text" value={form.member_id} readOnly={!!editMember} onChange={e => setForm({ ...form, member_id: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-soft2" /></div>
            <div><label className="block text-xs text-sub mb-1">이름 *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" /></div>
            <div><label className="block text-xs text-sub mb-1">표시이름</label>
              <input type="text" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" /></div>
            <div><label className="block text-xs text-sub mb-1">성별</label>
              <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2">
                <option value="">선택</option><option value="남">남</option><option value="여">여</option></select></div>
            <div><label className="block text-xs text-sub mb-1">연락처</label>
              <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" /></div>
            <div><label className="block text-xs text-sub mb-1">소속 클럽</label>
              <input type="text" value={form.club} onChange={e => setForm({ ...form, club: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" /></div>
            <div><label className="block text-xs text-sub mb-1">부서</label>
              <input type="text" value={form.division} onChange={e => setForm({ ...form, division: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" /></div>
            <div><label className="block text-xs text-sub mb-1">등급</label>
              <select value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2">
                <option value="">선택</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select></div>
            <div><label className="block text-xs text-sub mb-1">상태</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2">
                <option value="활성">활성</option><option value="휴면">휴면</option></select></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="bg-accent text-white px-4 py-2 rounded-lg text-sm">저장</button>
            <button onClick={() => setShowForm(false)} className="text-sm text-sub px-4 py-2">취소</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-soft2">
            <tr>
              <th className="px-3 py-2 text-left text-sub font-medium">이름</th>
              <th className="px-3 py-2 text-left text-sub font-medium">클럽</th>
              <th className="px-3 py-2 text-left text-sub font-medium">부서</th>
              <th className="px-3 py-2 text-center text-sub font-medium">등급</th>
              <th className="px-3 py-2 text-center text-sub font-medium">상태</th>
              <th className="px-3 py-2 text-center text-sub font-medium">등록비</th>
              <th className="px-3 py-2 text-center text-sub font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="text-center py-8 text-sub">로딩 중...</td></tr>
            : list.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-sub">검색 결과 없음</td></tr>
            : list.map(m => (
              <tr key={m.member_id} className="border-t border-line hover:bg-soft">
                <td className="px-3 py-2"><p className="font-medium">{m.display_name || m.name}</p><p className="text-[10px] text-sub">{m.member_id}</p></td>
                <td className="px-3 py-2 text-sub">{m.club || '-'}</td>
                <td className="px-3 py-2 text-sub">{m.division || '-'}</td>
                <td className="px-3 py-2 text-center font-semibold">{m.grade || '-'}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${m.status === '활성' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>{m.status}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  {isMembershipValid(m) ? <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">~{m.membership_paid_until}</span>
                    : <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600">미납</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex gap-1 justify-center flex-wrap">
                    <button onClick={() => startEdit(m)} className="text-xs text-accent hover:underline">수정</button>
                    <button onClick={() => openMembershipModal(m)} className="text-xs text-blue-600 hover:underline">등록비</button>
                    <button onClick={() => handleDelete(m)} className="text-xs text-red-500 hover:underline">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-sub mt-2">검색 결과: {list.length}명</p>

      {membershipModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-base font-bold mb-1">등록비 상태 변경</h3>
            <p className="text-sm text-sub mb-4">{membershipModal.name} ({membershipModal.member_id})</p>
            <div className="space-y-3">
              <div><label className="block text-xs text-sub mb-1">회원 상태</label>
                <select value={membershipForm.status} onChange={e => setMembershipForm({ ...membershipForm, status: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2">
                  <option value="활성">활성</option><option value="휴면">휴면</option></select></div>
              <div><label className="block text-xs text-sub mb-1">등록비 유효기간</label>
                <input type="date" value={membershipForm.until} onChange={e => setMembershipForm({ ...membershipForm, until: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2" /></div>
              <div><label className="block text-xs text-sub mb-1">변경 사유 *</label>
                <input type="text" value={membershipForm.reason} onChange={e => setMembershipForm({ ...membershipForm, reason: e.target.value })}
                  placeholder="예: 현장 납부 확인" className="w-full text-sm border border-line rounded-lg px-3 py-2" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setMembershipModal(null)} className="flex-1 py-2 border border-line rounded-lg text-sm text-sub">취소</button>
              <button onClick={handleMembershipSave} className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium">변경</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
