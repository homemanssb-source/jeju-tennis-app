import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

const RESULT_CONDITIONS = ['입상', '결승', '우승']

export default function PromotionRulesAdmin() {
  const showToast = useContext(ToastContext)
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({
    gender: '남', current_score: '', next_score: '',
    tournament_type: '(전체)', tournament_division: '(전체)',
    result_condition: '입상', minimum_count: ''
  })
  const [filterGender, setFilterGender] = useState('')

  useEffect(() => { fetchRules() }, [])

  async function fetchRules() {
    setLoading(true)
    const { data } = await supabase.from('promotion_rules')
      .select('*').order('gender').order('current_score')
    setRules(data || [])
    setLoading(false)
  }

  function startEdit(rule) {
    setEditingId(rule.id)
    setEditForm({ ...rule })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm({})
  }

  async function saveEdit() {
    const updateData = {
      gender: editForm.gender,
      current_score: editForm.current_score ? Number(editForm.current_score) : null,
      next_score: editForm.next_score ? Number(editForm.next_score) : null,
      tournament_type: editForm.tournament_type || '(전체)',
      tournament_division: editForm.tournament_division || '(전체)',
      result_condition: editForm.result_condition,
      minimum_count: editForm.minimum_count ? Number(editForm.minimum_count) : null,
    }
    const { error } = await supabase.from('promotion_rules').update(updateData).eq('id', editingId)
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.('등급 룰이 수정되었습니다.')
    cancelEdit()
    fetchRules()
  }

  async function handleAdd() {
    const insertData = {
      gender: addForm.gender,
      current_score: addForm.current_score ? Number(addForm.current_score) : null,
      next_score: addForm.next_score ? Number(addForm.next_score) : null,
      tournament_type: addForm.tournament_type || '(전체)',
      tournament_division: addForm.tournament_division || '(전체)',
      result_condition: addForm.result_condition,
      minimum_count: addForm.minimum_count ? Number(addForm.minimum_count) : null,
    }
    const { error } = await supabase.from('promotion_rules').insert([insertData])
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.('등급 룰이 추가되었습니다.')
    setShowAddForm(false)
    setAddForm({
      gender: '남', current_score: '', next_score: '',
      tournament_type: '(전체)', tournament_division: '(전체)',
      result_condition: '입상', minimum_count: ''
    })
    fetchRules()
  }

  async function handleDelete(rule) {
    if (!confirm(`이 등급 룰을 삭제하시겠습니까?\n${rule.gender} ${rule.current_score}→${rule.next_score}`)) return
    const { error } = await supabase.from('promotion_rules').delete().eq('id', rule.id)
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.('삭제되었습니다.')
    fetchRules()
  }

  const filtered = filterGender
    ? rules.filter(r => r.gender === filterGender)
    : rules

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">🎖️ 등급 룰 관리</h2>
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + 룰 추가
        </button>
      </div>

      {/* 안내 */}
      <div className="bg-soft rounded-r p-3 mb-4">
        <p className="text-xs text-sub">
          <b>결과조건:</b> 입상 = 4강 이상 | 결승 = 우승/준우승 | 우승 = 우승만<br />
          <b>대회구분:</b> (전체) = 모든 대회 | 전국대회 등 특정 대회만<br />
          <b>최소횟수:</b> 빈칸 = 조건 없음 (1회라도 해당되면 승급)
        </p>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        <select value={filterGender} onChange={e => setFilterGender(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">전체 성별</option>
          <option value="남">남</option>
          <option value="여">여</option>
        </select>
      </div>

      {/* 추가 폼 */}
      {showAddForm && (
        <div className="bg-white rounded-r border border-line p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold">새 등급 룰 추가</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-xs text-sub mb-1">성별</label>
              <select value={addForm.gender} onChange={e => setAddForm({ ...addForm, gender: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2">
                <option value="남">남</option>
                <option value="여">여</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">현재점수</label>
              <input type="number" step="0.5" value={addForm.current_score}
                onChange={e => setAddForm({ ...addForm, current_score: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">다음점수</label>
              <input type="number" step="0.5" value={addForm.next_score}
                onChange={e => setAddForm({ ...addForm, next_score: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">결과조건</label>
              <select value={addForm.result_condition}
                onChange={e => setAddForm({ ...addForm, result_condition: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2">
                {RESULT_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">대회구분</label>
              <input type="text" value={addForm.tournament_type}
                onChange={e => setAddForm({ ...addForm, tournament_type: e.target.value })}
                placeholder="(전체)"
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">대회부서</label>
              <input type="text" value={addForm.tournament_division}
                onChange={e => setAddForm({ ...addForm, tournament_division: e.target.value })}
                placeholder="(전체)"
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">최소횟수</label>
              <input type="number" value={addForm.minimum_count}
                onChange={e => setAddForm({ ...addForm, minimum_count: e.target.value })}
                placeholder="빈칸=없음"
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="bg-accent text-white px-4 py-2 rounded-lg text-sm">저장</button>
            <button onClick={() => setShowAddForm(false)} className="text-sm text-sub px-4 py-2">취소</button>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-r border border-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-soft2">
            <tr>
              <th className="px-3 py-2 text-left text-sub font-medium">성별</th>
              <th className="px-3 py-2 text-right text-sub font-medium">현재</th>
              <th className="px-3 py-2 text-center text-sub font-medium">→</th>
              <th className="px-3 py-2 text-left text-sub font-medium">다음</th>
              <th className="px-3 py-2 text-left text-sub font-medium">대회구분</th>
              <th className="px-3 py-2 text-left text-sub font-medium">대회부서</th>
              <th className="px-3 py-2 text-left text-sub font-medium">결과조건</th>
              <th className="px-3 py-2 text-right text-sub font-medium">최소횟수</th>
              <th className="px-3 py-2 text-center text-sub font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-8 text-sub">로딩 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-sub">등급 룰 없음</td></tr>
            ) : filtered.map(rule =>
              editingId === rule.id ? (
                <tr key={rule.id} className="border-t border-line bg-blue-50/50">
                  <td className="px-2 py-2">
                    <select value={editForm.gender || ''} onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                      className="w-full text-sm border border-accent rounded px-2 py-1">
                      <option value="남">남</option><option value="여">여</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" step="0.5" value={editForm.current_score ?? ''}
                      onChange={e => setEditForm({ ...editForm, current_score: e.target.value })}
                      className="w-full text-sm border border-accent rounded px-2 py-1 text-right" />
                  </td>
                  <td className="px-2 py-2 text-center">→</td>
                  <td className="px-2 py-2">
                    <input type="number" step="0.5" value={editForm.next_score ?? ''}
                      onChange={e => setEditForm({ ...editForm, next_score: e.target.value })}
                      className="w-full text-sm border border-accent rounded px-2 py-1" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="text" value={editForm.tournament_type || ''}
                      onChange={e => setEditForm({ ...editForm, tournament_type: e.target.value })}
                      className="w-full text-sm border border-accent rounded px-2 py-1" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="text" value={editForm.tournament_division || ''}
                      onChange={e => setEditForm({ ...editForm, tournament_division: e.target.value })}
                      className="w-full text-sm border border-accent rounded px-2 py-1" />
                  </td>
                  <td className="px-2 py-2">
                    <select value={editForm.result_condition || ''}
                      onChange={e => setEditForm({ ...editForm, result_condition: e.target.value })}
                      className="w-full text-sm border border-accent rounded px-2 py-1">
                      {RESULT_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" value={editForm.minimum_count ?? ''}
                      onChange={e => setEditForm({ ...editForm, minimum_count: e.target.value })}
                      className="w-full text-sm border border-accent rounded px-2 py-1 text-right" />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button onClick={saveEdit} className="text-xs text-white bg-accent px-2 py-1 rounded">저장</button>
                      <button onClick={cancelEdit} className="text-xs text-sub px-2 py-1">취소</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={rule.id} className="border-t border-line hover:bg-soft">
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      rule.gender === '남' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                    }`}>{rule.gender}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{rule.current_score}</td>
                  <td className="px-3 py-2 text-center text-sub">→</td>
                  <td className="px-3 py-2 font-bold text-accent">{rule.next_score}</td>
                  <td className="px-3 py-2 text-sub">{rule.tournament_type || '(전체)'}</td>
                  <td className="px-3 py-2 text-sub">{rule.tournament_division || '(전체)'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      rule.result_condition === '우승' ? 'bg-yellow-50 text-yellow-700' :
                      rule.result_condition === '결승' ? 'bg-orange-50 text-orange-700' :
                      'bg-green-50 text-green-700'
                    }`}>{rule.result_condition}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{rule.minimum_count ?? <span className="text-sub">-</span>}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => startEdit(rule)} className="text-xs text-accent hover:underline">수정</button>
                      <button onClick={() => handleDelete(rule)} className="text-xs text-red-500 hover:underline">삭제</button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-sub mt-2">총 {filtered.length}개 룰</p>
    </div>
  )
}
