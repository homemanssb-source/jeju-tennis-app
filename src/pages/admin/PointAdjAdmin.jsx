import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function PointAdjAdmin() {
  const showToast = useContext(ToastContext)
  const [members, setMembers] = useState([])
  const [adjustments, setAdjustments] = useState([])
  const [memberSearch, setMemberSearch] = useState('')
  const [form, setForm] = useState({
    member_id: '', score_change: '', reason: '', date: new Date().toISOString().slice(0, 10)
  })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: mems }, { data: adjs }] = await Promise.all([
      supabase.from('members').select('member_id, name, display_name, division').eq('status', '활성').order('name'),
      supabase.from('adjustments').select('*').order('date', { ascending: false }).limit(50),
    ])
    setMembers(mems || [])
    setAdjustments(adjs || [])
  }

  const filteredMembers = memberSearch.trim()
    ? members.filter(m =>
        (m.name || '').includes(memberSearch) ||
        (m.display_name || '').includes(memberSearch) ||
        (m.member_id || '').includes(memberSearch)
      ).slice(0, 10)
    : []

  async function handleSave() {
    if (!form.member_id || !form.score_change || !form.reason) {
      showToast?.('회원, 조정값, 사유를 모두 입력해주세요.', 'error')
      return
    }

    const member = members.find(m => m.member_id === form.member_id)
    const seasonYear = new Date(form.date).getFullYear()

    const { error } = await supabase.from('adjustments').insert([{
      member_id: form.member_id,
      member_name: member?.display_name || member?.name || '',
      score_change: Number(form.score_change),
      reason: form.reason,
      date: form.date,
      season_year: seasonYear,
    }])

    if (error) { showToast?.(error.message, 'error'); return }

    const sign = Number(form.score_change) >= 0 ? '+' : ''
    showToast?.(`${member?.name} ${sign}${form.score_change}점 조정 완료`)
    setForm({ member_id: '', score_change: '', reason: '', date: form.date })
    setMemberSearch('')
    fetchAll()
  }

  async function handleDelete(id) {
    if (!confirm('이 조정 내역을 삭제하시겠습니까?')) return
    await supabase.from('adjustments').delete().eq('id', id)
    showToast?.('삭제되었습니다.')
    fetchAll()
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">➕ 포인트 수동 조정</h2>

      {/* 입력 폼 */}
      <div className="bg-white rounded-r border border-line p-4 mb-4 space-y-3">
        {/* 회원 검색 */}
        <div className="relative">
          <label className="block text-xs text-sub mb-1">회원 검색</label>
          <input type="text" value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)}
            placeholder="이름 또는 ID..."
            className="w-full text-sm border border-line rounded-lg px-3 py-2" />
          {form.member_id && (
            <p className="text-xs text-accent mt-1">
              선택: {members.find(m => m.member_id === form.member_id)?.name}
            </p>
          )}
          {filteredMembers.length > 0 && (
            <div className="absolute left-0 right-0 top-full bg-white border border-line rounded-lg shadow-lg mt-1 z-10 max-h-40 overflow-y-auto">
              {filteredMembers.map(m => (
                <button key={m.member_id}
                  onClick={() => {
                    setForm({ ...form, member_id: m.member_id })
                    setMemberSearch(m.display_name || m.name)
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-soft border-b border-line/50">
                  {m.display_name || m.name} <span className="text-sub">({m.member_id})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-sub mb-1">조정값 (양수/음수)</label>
            <input type="number" value={form.score_change}
              onChange={e => setForm({ ...form, score_change: e.target.value })}
              placeholder="예: 50 또는 -30"
              className="w-full text-sm border border-line rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-sub mb-1">날짜</label>
            <input type="date" value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full text-sm border border-line rounded-lg px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-sub mb-1">사유 (필수)</label>
          <textarea value={form.reason}
            onChange={e => setForm({ ...form, reason: e.target.value })}
            placeholder="조정 사유를 입력하세요"
            className="w-full text-sm border border-line rounded-lg px-3 py-2 h-16 resize-none" />
        </div>

        <button onClick={handleSave}
          className="w-full bg-accent text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          조정 저장
        </button>
      </div>

      {/* 조정 내역 */}
      <div className="bg-white rounded-r border border-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-soft2">
            <tr>
              <th className="px-3 py-2 text-left text-sub font-medium">날짜</th>
              <th className="px-3 py-2 text-left text-sub font-medium">회원</th>
              <th className="px-3 py-2 text-right text-sub font-medium">조정값</th>
              <th className="px-3 py-2 text-left text-sub font-medium">사유</th>
              <th className="px-3 py-2 text-center text-sub font-medium">삭제</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-sub">조정 내역 없음</td></tr>
            ) : adjustments.map(a => (
              <tr key={a.id} className="border-t border-line hover:bg-soft">
                <td className="px-3 py-2 text-sub text-xs">{a.date}</td>
                <td className="px-3 py-2">{a.member_name || a.member_id}</td>
                <td className={`px-3 py-2 text-right font-semibold
                  ${a.score_change >= 0 ? 'text-accent' : 'text-red-500'}`}>
                  {a.score_change >= 0 ? '+' : ''}{a.score_change}
                </td>
                <td className="px-3 py-2 text-sub text-xs max-w-[200px] truncate">{a.reason}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => handleDelete(a.id)}
                    className="text-xs text-red-500 hover:underline">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
