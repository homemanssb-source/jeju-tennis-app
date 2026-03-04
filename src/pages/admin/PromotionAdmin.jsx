import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function PromotionAdmin() {
  const showToast = useContext(ToastContext)
  const [runs, setRuns] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [selectedRun, setSelectedRun] = useState(null)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentRunId = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

  // 실행 대상 월 선택 (과거 월도 가능)
  const [targetYear, setTargetYear] = useState(currentYear)
  const [targetMonth, setTargetMonth] = useState(currentMonth)
  const targetRunId = `${targetYear}-${String(targetMonth).padStart(2, '0')}`

  useEffect(() => { fetchRuns() }, [])

  async function fetchRuns() {
    setLoading(true)
    const { data } = await supabase
      .from('promotion_runs')
      .select('*')
      .order('run_id', { ascending: false })
    setRuns(data || [])
    setLoading(false)
  }

  async function fetchLogs(runId) {
    setSelectedRun(runId)
    const { data } = await supabase
      .from('promotion_log')
      .select('*')
      .eq('run_id', runId)
      .order('logged_at', { ascending: false })
    setLogs(data || [])
  }

  const alreadyRun = runs.some(r => r.run_id === targetRunId)
  const targetRun = runs.find(r => r.run_id === targetRunId)

  async function handleExecute() {
    if (alreadyRun) {
      showToast?.(`${targetRunId} 배치는 이미 실행되었습니다.`, 'warning')
      return
    }
    if (!confirm(`${targetRunId} 승급 배치를 실행하시겠습니까?`)) return

    setExecuting(true)
    const { data, error } = await supabase.rpc('run_monthly_promotions', {
      p_year: targetYear,
      p_month: targetMonth,
      p_entered_by: 'admin',
    })

    if (error) {
      showToast?.(error.message, 'error')
    } else if (data?.ok) {
      showToast?.(`승급 배치 완료! ${data.affected}명 처리`)
      fetchRuns()
      fetchLogs(data.run_id)
    } else {
      showToast?.(data?.message || '실행 실패', 'warning')
    }
    setExecuting(false)
  }

  // 배치 기록 삭제 (승급자 0명인 경우만)
  async function handleDeleteRun() {
    if (!targetRun) return
    if (targetRun.affected > 0) {
      showToast?.('승급자가 있는 배치는 삭제할 수 없습니다.', 'error')
      return
    }
    if (!confirm(`${targetRunId} 배치 기록을 삭제하시겠습니까?\n삭제 후 다시 실행할 수 있습니다.`)) return

    // 로그도 함께 삭제
    await supabase.from('promotion_log').delete().eq('run_id', targetRunId)
    const { error } = await supabase.from('promotion_runs').delete().eq('run_id', targetRunId)
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.(`${targetRunId} 배치 기록이 삭제되었습니다.`)
    fetchRuns()
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">🎖️ 승급 배치 관리</h2>

      {/* 배치 실행 */}
      <div className="bg-white rounded-r border border-line p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold">승급 배치 실행</p>
            <div className="flex items-center gap-2 mt-2">
              <select value={targetYear} onChange={e => setTargetYear(Number(e.target.value))}
                className="text-sm border border-line rounded-lg px-3 py-2">
                {[currentYear - 1, currentYear].map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select value={targetMonth} onChange={e => setTargetMonth(Number(e.target.value))}
                className="text-sm border border-line rounded-lg px-3 py-2">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <span className={`text-xs px-2 py-1 rounded ${
                alreadyRun ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
              }`}>
                {alreadyRun ? `✅ 실행됨 (${targetRun?.affected || 0}명)` : '⏳ 미실행'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {alreadyRun && targetRun?.affected === 0 && (
              <button onClick={handleDeleteRun}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100">
                🗑 기록 삭제
              </button>
            )}
            <button
              onClick={handleExecute}
              disabled={executing || alreadyRun}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${alreadyRun
                  ? 'bg-gray-200 text-sub cursor-not-allowed'
                  : 'bg-accent text-white hover:bg-blue-700'
                } disabled:opacity-50`}
            >
              {executing ? '실행 중...' : alreadyRun ? '실행 완료' : `${targetRunId} 배치 실행`}
            </button>
          </div>
        </div>

        {alreadyRun && targetRun?.affected === 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-700">
              ⚠️ {targetRunId} 배치가 실행되었으나 승급자가 0명입니다. "기록 삭제" 후 다시 실행할 수 있습니다.
            </p>
          </div>
        )}
      </div>

      {/* 실행 기록 */}
      <div className="bg-white rounded-r border border-line overflow-x-auto mb-4">
        <div className="px-4 py-3 border-b border-line">
          <h3 className="text-sm font-semibold">실행 기록</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-soft2">
            <tr>
              <th className="px-3 py-2 text-left text-sub font-medium">실행 ID</th>
              <th className="px-3 py-2 text-left text-sub font-medium">실행 시각</th>
              <th className="px-3 py-2 text-left text-sub font-medium">실행자</th>
              <th className="px-3 py-2 text-right text-sub font-medium">처리 수</th>
              <th className="px-3 py-2 text-center text-sub font-medium">상세</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-sub">로딩 중...</td></tr>
            ) : runs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-sub">실행 기록 없음</td></tr>
            ) : runs.map(r => (
              <tr key={r.run_id} className={`border-t border-line hover:bg-soft
                ${selectedRun === r.run_id ? 'bg-accentSoft' : ''}`}>
                <td className="px-3 py-2 font-medium">{r.run_id}</td>
                <td className="px-3 py-2 text-sub text-xs">
                  {new Date(r.executed_at).toLocaleString('ko-KR')}
                </td>
                <td className="px-3 py-2 text-sub">{r.executed_by}</td>
                <td className="px-3 py-2 text-right font-semibold">{r.affected}명</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => fetchLogs(r.run_id)}
                    className="text-xs text-accent hover:underline">보기</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 상세 로그 */}
      {selectedRun && (
        <div className="bg-white rounded-r border border-line overflow-x-auto">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h3 className="text-sm font-semibold">{selectedRun} 상세 로그</h3>
            <button onClick={() => { setSelectedRun(null); setLogs([]) }}
              className="text-xs text-sub hover:text-gray-700">닫기</button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-soft2">
              <tr>
                <th className="px-3 py-2 text-left text-sub font-medium">회원</th>
                <th className="px-3 py-2 text-left text-sub font-medium">변경 전</th>
                <th className="px-3 py-2 text-center text-sub font-medium">→</th>
                <th className="px-3 py-2 text-left text-sub font-medium">변경 후</th>
                <th className="px-3 py-2 text-left text-sub font-medium">사유</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-sub">변경 내역 없음</td></tr>
              ) : logs.map(l => (
                <tr key={l.id} className="border-t border-line">
                  <td className="px-3 py-2 font-medium">{l.member_name}</td>
                  <td className="px-3 py-2 text-sub">{l.before_grade}</td>
                  <td className="px-3 py-2 text-center">→</td>
                  <td className="px-3 py-2 text-accent font-semibold">{l.after_grade}</td>
                  <td className="px-3 py-2 text-xs text-sub">{l.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
