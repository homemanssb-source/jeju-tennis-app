import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function GradeAdmin() {
  const showToast = useContext(ToastContext)
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [newGrade, setNewGrade] = useState('')

  useEffect(() => { fetchGrades() }, [])

  async function fetchGrades() {
    setLoading(true)
    const { data } = await supabase.from('grade_options').select('*').order('sort_order')
    setGrades(data || [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!newGrade.trim()) { showToast?.('등급을 입력해주세요.', 'error'); return }
    const maxOrder = grades.length > 0 ? Math.max(...grades.map(g => g.sort_order)) + 1 : 1
    const { error } = await supabase.from('grade_options').insert([{
      grade_value: newGrade.trim(),
      sort_order: maxOrder,
      active: true,
    }])
    if (error) { showToast?.('추가 실패: ' + error.message, 'error'); return }
    showToast?.('등급 추가 완료')
    setNewGrade('')
    fetchGrades()
  }

  async function handleToggle(id, active) {
    await supabase.from('grade_options').update({ active: !active }).eq('id', id)
    showToast?.(!active ? '활성화됨' : '비활성화됨')
    fetchGrades()
  }

  async function handleDelete(id) {
    if (!confirm('이 등급을 삭제하시겠습니까?')) return
    await supabase.from('grade_options').delete().eq('id', id)
    showToast?.('삭제됨')
    fetchGrades()
  }

  async function handleMove(id, direction) {
    const idx = grades.findIndex(g => g.id === id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= grades.length) return

    const currentOrder = grades[idx].sort_order
    const swapOrder = grades[swapIdx].sort_order

    await Promise.all([
      supabase.from('grade_options').update({ sort_order: swapOrder }).eq('id', grades[idx].id),
      supabase.from('grade_options').update({ sort_order: currentOrder }).eq('id', grades[swapIdx].id),
    ])
    fetchGrades()
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">📊 등급 관리</h2>
      <p className="text-xs text-sub mb-4">회원가입 시 선택 가능한 등급 목록을 관리합니다. 순서 변경, 추가, 삭제가 가능합니다.</p>

      {/* 등급 추가 */}
      <div className="flex gap-2 mb-4">
        <input type="text" value={newGrade} onChange={e => setNewGrade(e.target.value)}
          placeholder="새 등급 입력 (예: 7)"
          className="flex-1 text-sm border border-line rounded-lg px-3 py-2"
          onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <button onClick={handleAdd}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          추가
        </button>
      </div>

      {/* 등급 목록 */}
      <div className="bg-white rounded-lg border border-line">
        {loading ? (
          <p className="text-center py-8 text-sub text-sm">로딩 중...</p>
        ) : grades.length === 0 ? (
          <p className="text-center py-8 text-sub text-sm">등록된 등급이 없습니다.</p>
        ) : (
          <div className="divide-y divide-line">
            {grades.map((g, idx) => (
              <div key={g.id} className={`flex items-center justify-between px-4 py-3 ${!g.active ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-800 w-12">{g.grade_value}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${g.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {g.active ? '활성' : '비활성'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleMove(g.id, 'up')} disabled={idx === 0}
                    className="text-xs px-2 py-1 text-sub hover:text-gray-700 disabled:opacity-30">▲</button>
                  <button onClick={() => handleMove(g.id, 'down')} disabled={idx === grades.length - 1}
                    className="text-xs px-2 py-1 text-sub hover:text-gray-700 disabled:opacity-30">▼</button>
                  <button onClick={() => handleToggle(g.id, g.active)}
                    className={`text-xs px-2 py-1 ${g.active ? 'text-yellow-600' : 'text-green-600'} hover:underline`}>
                    {g.active ? '비활성' : '활성'}
                  </button>
                  <button onClick={() => handleDelete(g.id)}
                    className="text-xs px-2 py-1 text-red-500 hover:underline">삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-sub mt-2">총 {grades.filter(g => g.active).length}개 활성 / {grades.length}개 전체</p>
    </div>
  )
}
