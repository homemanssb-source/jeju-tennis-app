import { useState, useEffect, useContext } from 'react'
import { supabase, writeLog } from '../../lib/supabase'
import { ToastContext } from '../../App'
import { useAdmin } from './AdminLayout'

export default function ClubAdmin() {
  const showToast = useContext(ToastContext)
  const adminUser = useAdmin()

  const [clubs, setClubs] = useState([])        // [{ club, count }]
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])  // 병합할 클럽명들
  const [targetName, setTargetName] = useState('')
  const [merging, setMerging] = useState(false)
  const [confirmModal, setConfirmModal] = useState(false)
  const [editModal, setEditModal] = useState(null)   // { club, count } — 단일 이름 변경
  const [editName, setEditName] = useState('')

  useEffect(() => { fetchClubs() }, [])

  async function fetchClubs() {
    setLoading(true)
    // members 테이블에서 club별 카운트
    const { data, error } = await supabase
      .from('members')
      .select('club')
      .neq('status', '삭제')

    if (error) { showToast?.('불러오기 실패: ' + error.message, 'error'); setLoading(false); return }

    // 프론트에서 집계 (NULL/빈값 포함)
    const map = {}
    data.forEach(row => {
      const key = row.club?.trim() || '(소속 없음)'
      map[key] = (map[key] || 0) + 1
    })

    const list = Object.entries(map)
      .map(([club, count]) => ({ club, count }))
      .sort((a, b) => b.count - a.count)

    setClubs(list)
    setLoading(false)
  }

  function toggleSelect(clubName) {
    setSelected(prev =>
      prev.includes(clubName)
        ? prev.filter(c => c !== clubName)
        : [...prev, clubName]
    )
  }

  function openMergeModal() {
    if (selected.length < 2) { showToast?.('2개 이상 선택하세요.', 'error'); return }
    // 기본 대표명: 인원이 가장 많은 클럽명
    const biggest = clubs
      .filter(c => selected.includes(c.club))
      .sort((a, b) => b.count - a.count)[0]
    setTargetName(biggest?.club || '')
    setConfirmModal(true)
  }

  async function handleMerge() {
    if (!targetName.trim()) { showToast?.('대표 클럽명을 입력하세요.', 'error'); return }
    const sources = selected.filter(c => c !== '(소속 없음)')
    if (sources.length === 0) { showToast?.('병합할 클럽이 없습니다.', 'error'); return }

    setMerging(true)

    // 선택된 이름 전부 → targetName으로 UPDATE
    const { error } = await supabase
      .from('members')
      .update({ club: targetName.trim() })
      .in('club', sources)

    if (error) {
      showToast?.('병합 실패: ' + error.message, 'error')
      setMerging(false)
      return
    }

    await writeLog({
      adminEmail: adminUser?.email,
      adminName: adminUser?.name,
      action: 'UPDATE',
      targetTable: 'members',
      targetId: 'club_merge',
      targetLabel: `클럽명 병합: [${sources.join(', ')}] → "${targetName.trim()}"`,
      afterData: { merged: sources, result: targetName.trim() },
    })

    showToast?.(`병합 완료: ${sources.length}개 이름 → "${targetName.trim()}"`)
    setSelected([])
    setConfirmModal(false)
    setTargetName('')
    setMerging(false)
    fetchClubs()
  }

  function openEditModal(item) {
    setEditModal(item)
    setEditName(item.club === '(소속 없음)' ? '' : item.club)
  }

  async function handleSingleRename() {
    if (!editName.trim()) { showToast?.('새 클럽명을 입력하세요.', 'error'); return }
    if (editModal.club === '(소속 없음)') { showToast?.('소속 없음은 변경할 수 없습니다.', 'error'); return }

    const { error } = await supabase
      .from('members')
      .update({ club: editName.trim() })
      .eq('club', editModal.club)

    if (error) { showToast?.('변경 실패: ' + error.message, 'error'); return }

    await writeLog({
      adminEmail: adminUser?.email,
      adminName: adminUser?.name,
      action: 'UPDATE',
      targetTable: 'members',
      targetId: 'club_rename',
      targetLabel: `클럽명 변경: "${editModal.club}" → "${editName.trim()}"`,
      afterData: { before: editModal.club, after: editName.trim() },
    })

    showToast?.(`"${editModal.club}" → "${editName.trim()}" 변경 완료`)
    setEditModal(null)
    setEditName('')
    fetchClubs()
  }

  const totalMembers = clubs.reduce((s, c) => s + c.count, 0)

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">🏢 클럽 관리</h2>
          <p className="text-xs text-sub mt-0.5">클럽명 병합 · 이름 통일</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-sub">총 클럽 <span className="font-bold text-gray-900">{clubs.length}</span>개</p>
          <p className="text-xs text-sub">총 회원 <span className="font-bold text-gray-900">{totalMembers}</span>명</p>
        </div>
      </div>

      {/* 사용 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
        <p>📌 <b>병합 방법:</b> 같은 클럽의 여러 이름을 체크 → [선택 병합] → 대표명 확정</p>
        <p>✏️ <b>단순 변경:</b> 한 클럽명만 수정하려면 [수정] 버튼 클릭</p>
      </div>

      {/* 병합 버튼 */}
      {selected.length >= 2 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm font-medium text-amber-800">
            {selected.length}개 클럽명 선택됨
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setSelected([])}
              className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 bg-white"
            >
              선택 해제
            </button>
            <button
              onClick={openMergeModal}
              className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-medium"
            >
              선택 병합 →
            </button>
          </div>
        </div>
      )}

      {/* 클럽 목록 */}
      <div className="bg-white rounded-xl border border-line overflow-hidden">
        {loading ? (
          <p className="text-sm text-sub text-center py-10">불러오는 중...</p>
        ) : clubs.length === 0 ? (
          <p className="text-sm text-sub text-center py-10">클럽 데이터 없음</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-soft2">
              <tr>
                <th className="px-3 py-2 text-left w-8"></th>
                <th className="px-3 py-2 text-left text-xs text-sub font-medium">클럽명</th>
                <th className="px-3 py-2 text-center text-xs text-sub font-medium w-16">인원</th>
                <th className="px-3 py-2 text-center text-xs text-sub font-medium w-16">관리</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((item, idx) => {
                const isSelected = selected.includes(item.club)
                const isNone = item.club === '(소속 없음)'
                return (
                  <tr
                    key={item.club}
                    className={`border-t border-line transition-colors ${isSelected ? 'bg-accentSoft' : idx % 2 === 0 ? 'bg-white' : 'bg-soft/30'}`}
                  >
                    {/* 체크박스 */}
                    <td className="px-3 py-2.5 text-center">
                      {!isNone && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.club)}
                          className="w-4 h-4 accent-accent rounded"
                        />
                      )}
                    </td>

                    {/* 클럽명 */}
                    <td className="px-3 py-2.5">
                      <span className={`font-medium ${isNone ? 'text-sub italic' : 'text-gray-900'}`}>
                        {item.club}
                      </span>
                      {isSelected && (
                        <span className="ml-2 text-xs text-accent">✓ 선택됨</span>
                      )}
                    </td>

                    {/* 인원 */}
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs font-semibold text-gray-700">{item.count}명</span>
                    </td>

                    {/* 수정 버튼 */}
                    <td className="px-3 py-2.5 text-center">
                      {!isNone && (
                        <button
                          onClick={() => openEditModal(item)}
                          className="text-xs text-accent hover:underline"
                        >
                          수정
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 병합 확인 모달 ── */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-bold">클럽명 병합</h3>

            <div className="bg-soft rounded-lg p-3 space-y-1">
              <p className="text-xs text-sub font-medium mb-2">병합 대상 ({selected.length}개)</p>
              {selected.map(c => (
                <div key={c} className="flex items-center justify-between">
                  <span className="text-sm text-gray-800">{c}</span>
                  <span className="text-xs text-sub">
                    {clubs.find(x => x.club === c)?.count || 0}명
                  </span>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                대표 클럽명 (통일할 이름) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={targetName}
                onChange={e => setTargetName(e.target.value)}
                placeholder="대표 클럽명 입력"
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft"
              />
              <p className="text-xs text-sub mt-1">
                위 {selected.length}개 이름을 가진 모든 회원의 소속이 이 이름으로 변경됩니다.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setConfirmModal(false); setTargetName('') }}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleMerge}
                disabled={merging || !targetName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-medium disabled:opacity-50"
              >
                {merging ? '처리 중...' : '병합 확정'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 단일 이름 변경 모달 ── */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-bold">클럽명 수정</h3>

            <div className="bg-soft rounded-lg p-3">
              <p className="text-xs text-sub">현재 이름</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{editModal.club}</p>
              <p className="text-xs text-sub mt-1">회원 {editModal.count}명</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                새 클럽명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="새 클럽명 입력"
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setEditModal(null); setEditName('') }}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleSingleRename}
                disabled={!editName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-medium disabled:opacity-50"
              >
                변경 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
