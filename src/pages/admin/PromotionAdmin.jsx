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

  const alreadyRun = runs.some(r => r.run_id === currentRunId)

  async function handleExecute() {
    if (alreadyRun) {
      showToast?.(`${currentRunId} 배치는 이미 실행되었습니다.`, 'warning')
      return
    }
    if (!confirm(`${currentRunId} 승급 배치를 실행하시겠습니까?`)) return

    setExecuting(true)
    const { data, error } = await supabase.rpc('run_monthly_promotions', {
      p_year: currentYear,
      p_month: currentMonth,
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

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">🎖️ 승급 배치 관리</h2>

      {/* 이번 달 실행 */}
      <div className="bg-white rounded-r border border-line p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">이번 달 배치: {currentRunId}</p>
            <p className="text-xs text-sub mt-1">
              {alreadyRun ? '✅ 이미 실행됨' : '⏳ 미실행'}
            </p>
          </div>
          <button
            onClick={handleExecute}
            disabled={executing || alreadyRun}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${alreadyRun
                ? 'bg-gray-200 text-sub cursor-not-allowed'
                : 'bg-accent text-white hover:bg-blue-700'
              } disabled:opacity-50`}
          >
            {executing ? '실행 중...' : alreadyRun ? '실행 완료' : '배치 실행'}
          </button>
        </div>

        {alreadyRun && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-700">
              {currentRunId} 배치가 이미 실행되었습니다. 동일 월에 중복 실행은 불가합니다.
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
