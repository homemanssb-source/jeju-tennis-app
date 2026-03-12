import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ACTION_LABELS = {
  CREATE: { label: '추가', color: 'bg-green-50 text-green-700' },
  UPDATE: { label: '수정', color: 'bg-blue-50 text-blue-700' },
  DELETE: { label: '삭제', color: 'bg-red-50 text-red-600' },
}

const TABLE_LABELS = {
  members: '회원',
  payments: '결제',
  events: '대회',
  event_entries: '참가',
  admin_users: '관리자',
  notices: '공지',
  point_adjustments: '포인트조정',
  tournament_results: '대회결과',
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [filterTable, setFilterTable] = useState('')
  const [filterAdmin, setFilterAdmin] = useState('')
  const [selectedLog, setSelectedLog] = useState(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  useEffect(() => { fetchLogs() }, [page, filterAction, filterTable, filterAdmin])

  async function fetchLogs() {
    setLoading(true)
    let query = supabase.from('admin_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filterAction) query = query.eq('action', filterAction)
    if (filterTable) query = query.eq('target_table', filterTable)
    if (filterAdmin) query = query.ilike('admin_email', `%${filterAdmin}%`)

    const { data } = await query
    setLogs(data || [])
    setLoading(false)
  }

  function formatDate(d) {
    if (!d) return ''
    const dt = new Date(d)
    return `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold">📋 수정 로그</h2>

      {/* 필터 */}
      <div className="flex gap-2 flex-wrap">
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0) }}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">전체 액션</option>
          <option value="CREATE">추가</option>
          <option value="UPDATE">수정</option>
          <option value="DELETE">삭제</option>
        </select>

        <select value={filterTable} onChange={e => { setFilterTable(e.target.value); setPage(0) }}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">전체 대상</option>
          {Object.entries(TABLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <input type="text" value={filterAdmin}
          onChange={e => { setFilterAdmin(e.target.value); setPage(0) }}
          placeholder="관리자 이메일 검색..."
          className="text-sm border border-line rounded-lg px-3 py-2 w-48" />

        <button onClick={() => { setFilterAction(''); setFilterTable(''); setFilterAdmin(''); setPage(0) }}
          className="text-xs text-sub hover:text-gray-700 px-3 py-2 border border-line rounded-lg">
          초기화
        </button>
      </div>

      {/* 로그 목록 */}
      <div className="bg-white rounded-xl border border-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-soft2">
            <tr>
              <th className="px-3 py-2 text-left text-xs text-sub font-medium whitespace-nowrap">시간</th>
              <th className="px-3 py-2 text-left text-xs text-sub font-medium">관리자</th>
              <th className="px-3 py-2 text-center text-xs text-sub font-medium">액션</th>
              <th className="px-3 py-2 text-left text-xs text-sub font-medium">대상</th>
              <th className="px-3 py-2 text-left text-xs text-sub font-medium">내용</th>
              <th className="px-3 py-2 text-center text-xs text-sub font-medium">상세</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-sub">불러오는 중...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-sub">로그가 없습니다.</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className="border-t border-line hover:bg-soft">
                <td className="px-3 py-2 text-xs text-sub whitespace-nowrap">{formatDate(log.created_at)}</td>
                <td className="px-3 py-2 text-xs">
                  <p className="font-medium">{log.admin_name}</p>
                  <p className="text-sub">{log.admin_email}</p>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${ACTION_LABELS[log.action]?.color || ''}`}>
                    {ACTION_LABELS[log.action]?.label || log.action}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">
                  {TABLE_LABELS[log.target_table] || log.target_table}
                </td>
                <td className="px-3 py-2 text-xs text-gray-700 max-w-[200px] truncate">
                  {log.target_label || log.target_id || '-'}
                </td>
                <td className="px-3 py-2 text-center">
                  {(log.before_data || log.after_data) && (
                    <button onClick={() => setSelectedLog(log)}
                      className="text-xs text-accent hover:underline">보기</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex justify-center gap-2">
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
          className="px-3 py-1.5 text-sm border border-line rounded-lg disabled:opacity-40">← 이전</button>
        <span className="px-3 py-1.5 text-sm text-sub">{page + 1} 페이지</span>
        <button onClick={() => setPage(p => p + 1)} disabled={logs.length < PAGE_SIZE}
          className="px-3 py-1.5 text-sm border border-line rounded-lg disabled:opacity-40">다음 →</button>
      </div>

      {/* 상세 모달 */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold">상세 내용</h3>
              <button onClick={() => setSelectedLog(null)} className="text-sub text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="text-xs text-sub space-y-1">
                <p><b>시간:</b> {new Date(selectedLog.created_at).toLocaleString('ko-KR')}</p>
                <p><b>관리자:</b> {selectedLog.admin_name} ({selectedLog.admin_email})</p>
                <p><b>대상:</b> {selectedLog.target_label || selectedLog.target_id}</p>
              </div>
              {selectedLog.before_data && (
                <div>
                  <p className="text-xs font-semibold text-red-600 mb-1">수정 전</p>
                  <pre className="text-xs bg-red-50 rounded-lg p-3 overflow-x-auto">
                    {JSON.stringify(selectedLog.before_data, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.after_data && (
                <div>
                  <p className="text-xs font-semibold text-green-600 mb-1">수정 후</p>
                  <pre className="text-xs bg-green-50 rounded-lg p-3 overflow-x-auto">
                    {JSON.stringify(selectedLog.after_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
