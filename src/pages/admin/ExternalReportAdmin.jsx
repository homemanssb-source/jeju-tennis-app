import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

const GRADE_OPTIONS = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6']

export default function ExternalReportAdmin() {
  const showToast = useContext(ToastContext)

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())

  const [filterStatus, setFilterStatus] = useState('pending')
  const [filterType, setFilterType] = useState('')

  const [noteModal, setNoteModal] = useState(null)
  const [detailModal, setDetailModal] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [rejectModal, setRejectModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)   // 삭제 모달
  const [gradeModal, setGradeModal] = useState(null)     // 등급 직접 수정 모달

  useEffect(() => { fetchReports() }, [filterStatus, filterType])

  async function fetchReports() {
    setLoading(true)
    let query = supabase
      .from('external_report_log')
      .select('*')
      .order('reported_at', { ascending: false })

    if (filterStatus === 'pending') query = query.eq('admin_applied', false)
    if (filterStatus === 'applied') query = query.eq('admin_applied', true)
    if (filterType) query = query.eq('tournament_type', filterType)

    const { data, error } = await query
    if (error) showToast?.('로딩 실패: ' + error.message, 'error')
    setReports(data || [])
    setSelected(new Set())
    setLoading(false)
  }

  function toggleSelect(id) {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  function toggleSelectAll() {
    const pendingIds = reports.filter(r => !r.admin_applied).map(r => r.id)
    if (selected.size === pendingIds.length) setSelected(new Set())
    else setSelected(new Set(pendingIds))
  }

  function handleApplyClick(report) {
    setConfirmModal({ type: 'single', ids: [report.id], report })
  }

  function handleBulkApplyClick() {
    if (selected.size === 0) { showToast?.('적용할 항목을 선택해주세요.', 'error'); return }
    setConfirmModal({ type: 'bulk', ids: [...selected] })
  }

  async function doApply(ids) {
    setConfirmModal(null)
    let successCount = 0, failCount = 0

    for (const id of ids) {
      const report = reports.find(r => r.id === id)
      if (!report || report.admin_applied) continue

      if (report.expected_grade && Number(report.expected_grade) !== Number(report.before_grade)) {
        const { error: memberError } = await supabase
          .from('members')
          .update({ grade: report.expected_grade, grade_source: 'manual' })
          .eq('member_id', report.member_id)
        if (memberError) { failCount++; continue }
      }

      const { error: logError } = await supabase
        .from('external_report_log')
        .update({ admin_applied: true, admin_applied_at: new Date().toISOString() })
        .eq('id', id)

      if (logError) failCount++
      else successCount++
    }

    if (successCount > 0) showToast?.(`✅ ${successCount}건 적용 완료`)
    if (failCount > 0) showToast?.(`⚠️ ${failCount}건 실패`, 'error')
    fetchReports()
  }

  function handleRejectClick(id) {
    setRejectModal({ id })
  }

  async function doReject(id) {
    setRejectModal(null)
    const { error } = await supabase
      .from('external_report_log')
      .update({ admin_applied: false, admin_applied_at: null })
      .eq('id', id)
    if (error) { showToast?.('처리 실패', 'error'); return }
    showToast?.('미반영 처리되었습니다.')
    fetchReports()
  }

  // ── 삭제 ──────────────────────────────────────────
  function handleDeleteClick(report) {
    setDeleteModal({ id: report.id, name: report.member_name, tournament: report.tournament_name })
  }

  async function doDelete(id) {
    setDeleteModal(null)
    const { error } = await supabase
      .from('external_report_log')
      .delete()
      .eq('id', id)
    if (error) { showToast?.('삭제 실패: ' + error.message, 'error'); return }
    showToast?.('삭제되었습니다.')
    fetchReports()
  }

  // ── 등급 직접 수정 ────────────────────────────────
  function handleGradeClick(report) {
    setGradeModal({
      id: report.id,
      member_id: report.member_id,
      member_name: report.member_name,
      current_grade: report.before_grade,
      new_grade: report.expected_grade ?? report.before_grade ?? '',
    })
  }

  async function doGradeUpdate() {
    if (!gradeModal.new_grade) { showToast?.('변경할 등급을 선택해주세요.', 'error'); return }
    const { error: memberError } = await supabase
      .from('members')
      .update({ grade: Number(gradeModal.new_grade), grade_source: 'manual' })
      .eq('member_id', gradeModal.member_id)

    if (memberError) { showToast?.('등급 변경 실패: ' + memberError.message, 'error'); return }

    // 로그도 업데이트
    await supabase
      .from('external_report_log')
      .update({
        expected_grade: Number(gradeModal.new_grade),
        admin_applied: true,
        admin_applied_at: new Date().toISOString(),
      })
      .eq('id', gradeModal.id)

    showToast?.(`✅ ${gradeModal.member_name} 등급이 ${gradeModal.new_grade}로 변경되었습니다.`)
    setGradeModal(null)
    fetchReports()
  }

  async function saveNote() {
    const { error } = await supabase
      .from('external_report_log')
      .update({ admin_note: noteModal.note })
      .eq('id', noteModal.id)
    if (error) { showToast?.('저장 실패', 'error'); return }
    showToast?.('메모 저장됨')
    setNoteModal(null)
    fetchReports()
  }

  const pendingCount = reports.filter(r => !r.admin_applied).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">🏆 외부대회 신고 관리</h2>
          {pendingCount > 0 && <p className="text-xs text-amber-600 mt-0.5">미처리 {pendingCount}건</p>}
        </div>
        {selected.size > 0 && (
          <button onClick={handleBulkApplyClick}
            className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            선택 {selected.size}건 일괄 적용
          </button>
        )}
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex gap-1 bg-soft rounded-lg p-1">
          {[{ key: 'pending', label: '미처리' }, { key: 'applied', label: '처리완료' }, { key: 'all', label: '전체' }].map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors
                ${filterStatus === f.key ? 'bg-white text-accent shadow-sm' : 'text-sub'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-soft rounded-lg p-1">
          {[{ key: '', label: '전체' }, { key: '전국대회', label: '전국' }, { key: '도내대회', label: '도내' }].map(f => (
            <button key={f.key} onClick={() => setFilterType(f.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors
                ${filterType === f.key ? 'bg-white text-accent shadow-sm' : 'text-sub'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-soft2">
            <tr>
              <th className="px-3 py-2 text-center">
                <input type="checkbox"
                  checked={selected.size > 0 && selected.size === reports.filter(r => !r.admin_applied).length}
                  onChange={toggleSelectAll} className="rounded" />
              </th>
              <th className="px-3 py-2 text-left text-sub font-medium">신고일</th>
              <th className="px-3 py-2 text-left text-sub font-medium">회원</th>
              <th className="px-3 py-2 text-left text-sub font-medium">대회명</th>
              <th className="px-3 py-2 text-center text-sub font-medium">구분</th>
              <th className="px-3 py-2 text-center text-sub font-medium">참가부서</th>
              <th className="px-3 py-2 text-center text-sub font-medium">결과</th>
              <th className="px-3 py-2 text-center text-sub font-medium">현재등급</th>
              <th className="px-3 py-2 text-center text-sub font-medium">예상등급</th>
              <th className="px-3 py-2 text-center text-sub font-medium">상태</th>
              <th className="px-3 py-2 text-center text-sub font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="text-center py-10 text-sub">로딩 중...</td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-10 text-sub">신고 내역이 없습니다.</td></tr>
            ) : reports.map(r => (
              <tr key={r.id} className={`border-t border-line hover:bg-soft transition-colors
                ${selected.has(r.id) ? 'bg-accentSoft' : ''}`}>
                <td className="px-3 py-2 text-center">
                  {!r.admin_applied && (
                    <input type="checkbox" checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)} className="rounded" />
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-sub whitespace-nowrap">
                  {new Date(r.reported_at).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-gray-900">{r.member_name}</p>
                  <p className="text-[10px] text-sub">{r.member_phone}</p>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => setDetailModal(r)} className="text-left hover:text-accent hover:underline">
                    <p className="font-medium">{r.tournament_name}</p>
                    <p className="text-[10px] text-sub">{r.tournament_date}</p>
                  </button>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                    ${r.tournament_type === '전국대회' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                    {r.tournament_type}
                  </span>
                </td>
                <td className="px-3 py-2 text-center text-xs text-sub">
                  {r.tournament_division || '-'}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                    ${r.result === '우승' ? 'bg-yellow-50 text-yellow-700' :
                      r.result === '준우승' ? 'bg-gray-100 text-gray-700' : 'bg-soft text-sub'}`}>
                    {r.result}
                  </span>
                </td>
                <td className="px-3 py-2 text-center font-medium">{r.before_grade ?? '-'}</td>
                <td className="px-3 py-2 text-center">
                  {r.expected_grade && Number(r.expected_grade) !== Number(r.before_grade) ? (
                    <span className="font-bold text-accent">{r.expected_grade}</span>
                  ) : (
                    <span className="text-sub text-xs">{r.expected_grade ?? '없음'}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {r.admin_applied ? (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">✅ 반영됨</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">🟡 검토중</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 justify-center flex-wrap">
                    {/* 적용/취소 */}
                    {!r.admin_applied ? (
                      <button onClick={() => handleApplyClick(r)}
                        className="text-xs text-white bg-accent px-2 py-1 rounded hover:bg-blue-700">적용</button>
                    ) : (
                      <button onClick={() => handleRejectClick(r.id)}
                        className="text-xs text-orange-500 hover:underline">취소</button>
                    )}
                    {/* 등급 직접 수정 */}
                    <button onClick={() => handleGradeClick(r)}
                      className="text-xs text-green-600 hover:underline">등급↑</button>
                    {/* 메모 */}
                    <button onClick={() => setNoteModal({ id: r.id, note: r.admin_note || '' })}
                      className="text-xs text-sub hover:text-gray-700">📝</button>
                    {/* 삭제 */}
                    <button onClick={() => handleDeleteClick(r)}
                      className="text-xs text-red-500 hover:underline">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-sub mt-2">총 {reports.length}건</p>

      {/* ── 적용 확인 모달 ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-base font-bold text-center">등급 적용 확인</h3>
            <p className="text-sm text-gray-700 text-center leading-relaxed">
              {confirmModal.type === 'bulk'
                ? <><b>{confirmModal.ids.length}건</b>을 일괄 적용하시겠습니까?</>
                : <>
                    <b>{confirmModal.report?.member_name}</b> — {confirmModal.report?.tournament_name}<br />
                    {confirmModal.report?.expected_grade && Number(confirmModal.report.expected_grade) !== Number(confirmModal.report.before_grade)
                      ? <span className="text-accent font-semibold">등급 {confirmModal.report.before_grade} → {confirmModal.report.expected_grade} 변경</span>
                      : <span className="text-sub text-xs">등급 변경 없이 반영 처리만 됩니다.</span>}
                  </>
              }
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">취소</button>
              <button onClick={() => doApply(confirmModal.ids)}
                className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-blue-700">적용</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 반영 취소 모달 ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRejectModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-base font-bold text-center">반영 취소 확인</h3>
            <p className="text-sm text-gray-700 text-center">이 신고를 미반영 처리하시겠습니까?</p>
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">취소</button>
              <button onClick={() => doReject(rejectModal.id)}
                className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600">미반영 처리</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-base font-bold text-center">🗑️ 신고 삭제</h3>
            <p className="text-sm text-gray-700 text-center leading-relaxed">
              <b>{deleteModal.name}</b>의<br />
              <b>"{deleteModal.tournament}"</b> 신고를<br />
              삭제하시겠습니까?<br />
              <span className="text-xs text-red-500">삭제 후 복구가 불가합니다.</span>
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal(null)}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">취소</button>
              <button onClick={() => doDelete(deleteModal.id)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600">삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 등급 직접 수정 모달 ── */}
      {gradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/50" onClick={() => setGradeModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-base font-bold text-center">✏️ 등급 직접 수정</h3>
            <div className="bg-soft rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-sub">회원</span>
                <span className="font-medium">{gradeModal.member_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sub">현재 등급</span>
                <span className="font-bold text-gray-800">{gradeModal.current_grade ?? '-'}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-sub mb-2">변경할 등급 선택</label>
              <div className="grid grid-cols-4 gap-2">
                {GRADE_OPTIONS.map(g => (
                  <button key={g} onClick={() => setGradeModal({ ...gradeModal, new_grade: g })}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors
                      ${gradeModal.new_grade === g
                        ? 'bg-accent text-white border-accent'
                        : 'bg-white text-gray-700 border-line hover:bg-soft2'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            {gradeModal.new_grade && (
              <div className="flex items-center justify-center gap-3 py-1">
                <span className="text-lg font-bold text-gray-400">{gradeModal.current_grade ?? '-'}</span>
                <span className="text-sub">→</span>
                <span className="text-lg font-bold text-accent">{gradeModal.new_grade}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setGradeModal(null)}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">취소</button>
              <button onClick={doGradeUpdate} disabled={!gradeModal.new_grade}
                className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                등급 변경 적용
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 메모 모달 ── */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/50" onClick={() => setNoteModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-base font-bold">📝 관리자 메모</h3>
            <textarea value={noteModal.note}
              onChange={e => setNoteModal({ ...noteModal, note: e.target.value })}
              placeholder="메모를 입력하세요 (회원에게 표시됩니다)"
              rows={4}
              className="w-full text-sm border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-accent resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setNoteModal(null)}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub">취소</button>
              <button onClick={saveNote}
                className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 상세 모달 ── */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-3">
            <h3 className="text-base font-bold">신고 상세</h3>
            <div className="space-y-2 text-sm">
              {[
                ['회원', `${detailModal.member_name} (${detailModal.member_phone})`],
                ['대회명', detailModal.tournament_name],
                ['날짜', detailModal.tournament_date],
                ['구분', detailModal.tournament_type],
                ['참가부서', detailModal.tournament_division || '-'],
                ['결과', detailModal.result],
                ['신고 당시 등급', detailModal.before_grade],
                ['예상 등급', detailModal.expected_grade ?? '없음'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-sub">{label}</span>
                  <span className={
                    label === '예상 등급' && detailModal.expected_grade &&
                    Number(detailModal.expected_grade) !== Number(detailModal.before_grade)
                      ? 'text-accent font-bold' : 'font-medium'
                  }>{value}</span>
                </div>
              ))}
              {detailModal.admin_note && (
                <div className="bg-soft rounded-lg px-3 py-2">
                  <p className="text-xs text-sub">관리자 메모</p>
                  <p className="text-sm">{detailModal.admin_note}</p>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sub">처리상태</span>
                <span className={detailModal.admin_applied ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                  {detailModal.admin_applied ? '✅ 반영됨' : '🟡 검토중'}
                </span>
              </div>
            </div>
            <button onClick={() => setDetailModal(null)}
              className="w-full py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">닫기</button>
          </div>
        </div>
      )}
    </div>
  )
}
