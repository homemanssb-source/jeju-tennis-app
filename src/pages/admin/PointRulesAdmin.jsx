import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

const POINT_COLS = [
  { key: 'points_1', label: '우승' },
  { key: 'points_2', label: '준우승' },
  { key: 'points_3', label: '4강' },
  { key: 'points_4', label: '8강' },
  { key: 'points_5', label: '16강' },
  { key: 'points_6', label: '32강' },
  { key: 'points_7', label: '참가' },
]

export default function PointRulesAdmin() {
  const showToast = useContext(ToastContext)
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ division: '' })
  const [reordering, setReordering] = useState(false)

  useEffect(() => { fetchRules() }, [])

  async function fetchRules() {
    setLoading(true)
    const { data } = await supabase
      .from('point_rules')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
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
    const updateData = { division: editForm.division }
    POINT_COLS.forEach(c => {
      const val = editForm[c.key]
      updateData[c.key] = val === '' || val === null || val === undefined ? null : Number(val)
    })
    const { error } = await supabase.from('point_rules').update(updateData).eq('id', editingId)
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.('포인트 규정이 수정되었습니다.')
    cancelEdit()
    fetchRules()
  }

  async function handleAdd() {
    if (!addForm.division) {
      showToast?.('부서명을 입력해주세요.', 'error'); return
    }
    // 현재 최대 sort_order + 1
    const maxOrder = rules.length > 0 ? Math.max(...rules.map(r => r.sort_order || 0)) : 0
    const insertData = { division: addForm.division, sort_order: maxOrder + 1 }
    POINT_COLS.forEach(c => {
      const val = addForm[c.key]
      insertData[c.key] = val === '' || val === undefined ? null : Number(val)
    })
    const { error } = await supabase.from('point_rules').insert([insertData])
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.('새 부서가 추가되었습니다.')
    setShowAddForm(false)
    setAddForm({ division: '' })
    fetchRules()
  }

  async function handleDelete(rule) {
    if (!confirm(`"${rule.division}" 포인트 규정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return
    const { error } = await supabase.from('point_rules').delete().eq('id', rule.id)
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.('삭제되었습니다.')
    fetchRules()
  }

  // ── 순서 변경 ──────────────────────────────────
  async function moveRule(idx, direction) {
    const newRules = [...rules]
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= newRules.length) return

    // 배열에서 위치 교환
    ;[newRules[idx], newRules[targetIdx]] = [newRules[targetIdx], newRules[idx]]

    // 화면 즉시 반영
    setRules(newRules)
    setReordering(true)

    // DB에 새 sort_order 일괄 저장
    try {
      const updates = newRules.map((r, i) =>
        supabase.from('point_rules').update({ sort_order: i + 1 }).eq('id', r.id)
      )
      await Promise.all(updates)
      showToast?.('순서가 저장되었습니다.')
    } catch (err) {
      showToast?.('순서 저장 실패', 'error')
      fetchRules() // 실패 시 원래대로
    }
    setReordering(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">📊 포인트 규정 관리</h2>
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + 새 부서 추가
        </button>
      </div>

      {/* 경고 */}
      <div className="bg-amber-50 border border-amber-200 rounded-r p-3 mb-4">
        <p className="text-xs text-amber-700">
          ⚠️ 포인트 규정 변경은 <b>이후 입력 데이터</b>에만 적용됩니다.
          기존 입력된 대회 결과의 포인트는 자동으로 변경되지 않습니다.
        </p>
      </div>

      {/* 추가 폼 */}
      {showAddForm && (
        <div className="bg-white rounded-r border border-line p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold">새 부서 추가</h3>
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-4 sm:col-span-1">
              <label className="block text-xs text-sub mb-1">부서명</label>
              <input type="text" value={addForm.division || ''}
                onChange={e => setAddForm({ ...addForm, division: e.target.value })}
                placeholder="예: 남성A"
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            {POINT_COLS.map(c => (
              <div key={c.key}>
                <label className="block text-xs text-sub mb-1">{c.label}</label>
                <input type="number" value={addForm[c.key] || ''}
                  onChange={e => setAddForm({ ...addForm, [c.key]: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="bg-accent text-white px-4 py-2 rounded-lg text-sm">저장</button>
            <button onClick={() => { setShowAddForm(false); setAddForm({ division: '' }) }}
              className="text-sm text-sub px-4 py-2">취소</button>
          </div>
        </div>
      )}

      {/* 순서 안내 */}
      <p className="text-xs text-sub mb-2">
        ↕️ 버튼으로 부서 순서를 변경할 수 있습니다. 이 순서가 대회 부서 드롭다운에도 반영됩니다.
      </p>

      {/* 규정 테이블 */}
      <div className="bg-white rounded-r border border-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-soft2">
            <tr>
              <th className="px-2 py-2 text-center font-medium text-sub w-16">순서</th>
              <th className="px-3 py-2 text-left font-medium text-sub">부서</th>
              {POINT_COLS.map(c => (
                <th key={c.key} className="px-3 py-2 text-right font-medium text-sub">{c.label}</th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-sub">옵션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center py-8 text-sub">로딩 중..</td></tr>
            ) : rules.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-8 text-sub">등록된 규정 없음</td></tr>
            ) : rules.map((rule, idx) => (
              editingId === rule.id ? (
                <tr key={rule.id} className="border-t border-line bg-blue-50/50">
                  {/* 수정 중엔 순서 버튼 비활성 */}
                  <td className="px-2 py-2 text-center text-sub text-xs">{idx + 1}</td>
                  <td className="px-2 py-2">
                    <input type="text" value={editForm.division || ''}
                      onChange={e => setEditForm({ ...editForm, division: e.target.value })}
                      className="w-full text-sm border border-accent rounded px-2 py-1" />
                  </td>
                  {POINT_COLS.map(c => (
                    <td key={c.key} className="px-2 py-2">
                      <input type="number" value={editForm[c.key] ?? ''}
                        onChange={e => setEditForm({ ...editForm, [c.key]: e.target.value })}
                        className="w-full text-sm border border-accent rounded px-2 py-1 text-right" />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button onClick={saveEdit}
                        className="text-xs text-white bg-accent px-2 py-1 rounded">저장</button>
                      <button onClick={cancelEdit}
                        className="text-xs text-sub px-2 py-1">취소</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={rule.id} className="border-t border-line hover:bg-soft">
                  {/* 업/다운 버튼 */}
                  <td className="px-2 py-2 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => moveRule(idx, 'up')}
                        disabled={idx === 0 || reordering}
                        className={`w-6 h-5 rounded text-xs flex items-center justify-center transition-colors
                          ${idx === 0 || reordering
                            ? 'text-gray-200 cursor-not-allowed'
                            : 'text-gray-400 hover:bg-orange-50 hover:text-orange-500'}`}>
                        ▲
                      </button>
                      <span className="text-xs text-gray-300 leading-none">{idx + 1}</span>
                      <button
                        onClick={() => moveRule(idx, 'down')}
                        disabled={idx === rules.length - 1 || reordering}
                        className={`w-6 h-5 rounded text-xs flex items-center justify-center transition-colors
                          ${idx === rules.length - 1 || reordering
                            ? 'text-gray-200 cursor-not-allowed'
                            : 'text-gray-400 hover:bg-orange-50 hover:text-orange-500'}`}>
                        ▼
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-medium">{rule.division}</td>
                  {POINT_COLS.map(c => (
                    <td key={c.key} className="px-3 py-2 text-right tabular-nums">
                      {rule[c.key] != null ? rule[c.key] : <span className="text-sub">-</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => startEdit(rule)}
                        className="text-xs text-accent hover:underline">수정</button>
                      <button onClick={() => handleDelete(rule)}
                        className="text-xs text-red-500 hover:underline">삭제</button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}