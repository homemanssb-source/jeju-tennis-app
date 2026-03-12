import { useState, useEffect, useContext } from 'react'
import { supabase, writeLog } from '../../lib/supabase'
import { ToastContext } from '../../App'
import { useAdmin } from './AdminLayout'

export default function PaymentAdmin() {
  const showToast = useContext(ToastContext)
  const adminUser = useAdmin()
  const [payments, setPayments] = useState([])
  const [members, setMembers] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMatched, setFilterMatched] = useState('')
  const [filterPurpose, setFilterPurpose] = useState('')
  const [uploading, setUploading] = useState(false)

  const [matchModal, setMatchModal] = useState(null)
  const [matchMemberId, setMatchMemberId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())

  const [uploadPurpose, setUploadPurpose] = useState('MEMBERSHIP_FEE')
  const [uploadEventId, setUploadEventId] = useState('')
  const [uploadYear, setUploadYear] = useState(new Date().getFullYear())

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: pays }, { data: mems }, { data: evts }] = await Promise.all([
      supabase.from('payments').select('*').order('uploaded_at', { ascending: false }).limit(200),
      supabase.from('members').select('member_id, name, display_name').neq('status', '탈퇴').order('name'),
      supabase.from('events').select('event_id, event_name').order('event_date', { ascending: false }),
    ])
    setPayments(pays || [])
    setMembers(mems || [])
    setEvents(evts || [])
    setLoading(false)
    return pays || []
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    try {
      const text = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target.result)
        reader.readAsText(file, 'EUC-KR')
      })
      const lines = text.split('\n').filter(l => l.trim())
      const rows = lines.slice(1)

      const newPayments = []
      for (const row of rows) {
        const cols = row.match(/(".*?"|[^,]*)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) || []
        if (cols.length < 3) continue
        const paidAt = cols[0] || null
        const amount = parseInt((cols[1] || '0').replace(/[^0-9-]/g, '')) || 0
        const senderName = cols[2] || ''
        if (!senderName || amount <= 0) continue
        const senderNorm = senderName.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase()
        const dedupeKey = `${paidAt}_${amount}_${senderNorm}`
        newPayments.push({
          paid_at: paidAt, amount, sender_name: senderName,
          sender_name_norm: senderNorm, dedupe_key: dedupeKey,
          purpose: uploadPurpose,
          target_year: uploadPurpose === 'MEMBERSHIP_FEE' ? uploadYear : null,
          target_event_id: uploadPurpose === 'EVENT_ENTRY_FEE' ? uploadEventId || null : null,
          raw_data: row,
        })
      }

      if (newPayments.length === 0) {
        showToast?.('파싱된 데이터가 없습니다.', 'error')
        setUploading(false)
        return
      }

      const { error } = await supabase.from('payments')
        .upsert(newPayments, { onConflict: 'dedupe_key', ignoreDuplicates: true })

      if (error) {
        showToast?.('업로드 실패: ' + error.message, 'error')
      } else {
        showToast?.(`${newPayments.length}건 업로드 완료! 자동매칭 시작...`)
        // ✅ fetchAll 완료 후 DB에서 직접 미매칭 건 가져와서 매칭
        const freshPayments = await fetchAll()
        await runAutoMatchWithData(freshPayments)
      }
    } catch (err) {
      showToast?.('파일 처리 오류: ' + err.message, 'error')
    }
    setUploading(false)
    e.target.value = ''
  }

  // ✅ 자동매칭 버그 수정 - 인자로 최신 데이터 받음
  async function runAutoMatchWithData(data) {
    const unmatched = (data || payments).filter(p => !p.matched)
    let matchedCount = 0
    for (const pay of unmatched) {
      const { data: result } = await supabase.rpc('match_payment', { p_payment_id: pay.payment_id })
      if (result?.ok) matchedCount++
    }
    if (matchedCount > 0) showToast?.(`자동매칭: ${matchedCount}건 성공`)
    fetchAll()
  }

  // 버튼으로 수동 자동매칭 실행 시
  async function runAutoMatch() {
    const freshPayments = await fetchAll()
    await runAutoMatchWithData(freshPayments)
  }

  async function handleManualMatch() {
    if (!matchModal || !matchMemberId) { showToast?.('회원을 선택해주세요.', 'error'); return }
    const { data, error } = await supabase.rpc('admin_manual_match_payment', {
      p_payment_id: matchModal.payment_id,
      p_member_id: matchMemberId,
      p_entered_by: 'admin',
    })
    if (error || !data?.ok) { showToast?.(data?.message || error?.message || '매칭 실패', 'error'); return }

    const matchedMember = members.find(m => m.member_id === matchMemberId)
    await writeLog({
      adminEmail: adminUser?.email,
      adminName: adminUser?.name,
      action: 'UPDATE',
      targetTable: 'payments',
      targetId: matchModal.payment_id,
      targetLabel: `결제 매칭: ${matchModal.sender_name} → ${matchedMember?.name}`,
      beforeData: { matched: false },
      afterData: { matched: true, matched_member_id: matchMemberId },
    })

    showToast?.('수동 매칭 완료!')
    setMatchModal(null); setMatchMemberId(''); setMemberSearch('')
    fetchAll()
  }

  // ✅ 개별 삭제
  async function handleSingleDelete(payment) {
    if (!confirm(`"${payment.sender_name}" ${payment.amount?.toLocaleString()}원 항목을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return
    const { error } = await supabase.from('payments').delete().eq('payment_id', payment.payment_id)
    if (error) { showToast?.('삭제 실패: ' + error.message, 'error'); return }

    await writeLog({
      adminEmail: adminUser?.email,
      adminName: adminUser?.name,
      action: 'DELETE',
      targetTable: 'payments',
      targetId: payment.payment_id,
      targetLabel: `결제 삭제: ${payment.sender_name} ${payment.amount?.toLocaleString()}원`,
      beforeData: payment,
    })

    showToast?.('삭제되었습니다.')
    fetchAll()
  }

  // 일괄 삭제
  async function handleBulkDelete() {
    if (selectedIds.size === 0) { showToast?.('삭제할 항목을 선택해주세요.', 'error'); return }
    if (!confirm(`선택한 ${selectedIds.size}건을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return
    const ids = [...selectedIds]
    const { error } = await supabase.from('payments').delete().in('payment_id', ids)
    if (error) { showToast?.('삭제 실패: ' + error.message, 'error'); return }

    await writeLog({
      adminEmail: adminUser?.email,
      adminName: adminUser?.name,
      action: 'DELETE',
      targetTable: 'payments',
      targetLabel: `결제 일괄삭제 ${ids.length}건`,
    })

    showToast?.(`${ids.length}건 삭제 완료`)
    setSelectedIds(new Set())
    fetchAll()
  }

  const filtered = payments.filter(p => {
    if (filterMatched === 'matched' && !p.matched) return false
    if (filterMatched === 'unmatched' && p.matched) return false
    if (filterPurpose && p.purpose !== filterPurpose) return false
    return true
  })

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(p => p.payment_id)))
  }

  function toggleSelect(id) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const filteredMembers = memberSearch.trim()
    ? members.filter(m =>
        (m.name || '').includes(memberSearch) ||
        (m.display_name || '').includes(memberSearch) ||
        (m.member_id || '').includes(memberSearch)
      ).slice(0, 10)
    : []

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">💰 결제(거래내역) 관리</h2>

      {/* 업로드 */}
      <div className="bg-white rounded-xl border border-line p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">📁 거래내역 업로드</h3>
        <p className="text-xs text-sub mb-3">CSV 파일 형식: 날짜, 금액, 입금자명 (첫 줄 헤더)</p>
        <div className="flex gap-2 mb-3 flex-wrap">
          <select value={uploadPurpose} onChange={e => setUploadPurpose(e.target.value)}
            className="text-sm border border-line rounded-lg px-3 py-2">
            <option value="MEMBERSHIP_FEE">등록비</option>
            <option value="EVENT_ENTRY_FEE">대회 참가비</option>
          </select>
          {uploadPurpose === 'MEMBERSHIP_FEE' && (
            <input type="number" value={uploadYear}
              onChange={e => setUploadYear(Number(e.target.value))}
              className="text-sm border border-line rounded-lg px-3 py-2 w-24" />
          )}
          {uploadPurpose === 'EVENT_ENTRY_FEE' && (
            <select value={uploadEventId} onChange={e => setUploadEventId(e.target.value)}
              className="text-sm border border-line rounded-lg px-3 py-2">
              <option value="">대회 선택</option>
              {events.map(ev => <option key={ev.event_id} value={ev.event_id}>{ev.event_name}</option>)}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <label className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-700">
            {uploading ? '업로드 중...' : 'CSV 파일 선택'}
            <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" disabled={uploading} />
          </label>
          <button onClick={runAutoMatch}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
            🔄 자동매칭 실행
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select value={filterMatched} onChange={e => setFilterMatched(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">전체</option>
          <option value="matched">매칭됨</option>
          <option value="unmatched">미매칭</option>
        </select>
        <select value={filterPurpose} onChange={e => setFilterPurpose(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">전체 용도</option>
          <option value="MEMBERSHIP_FEE">등록비</option>
          <option value="EVENT_ENTRY_FEE">참가비</option>
        </select>
        {selectedIds.size > 0 && (
          <button onClick={handleBulkDelete}
            className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600">
            🗑️ 선택 삭제 ({selectedIds.size}건)
          </button>
        )}
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl border border-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-soft2">
            <tr>
              <th className="px-2 py-2 text-center w-10">
                <input type="checkbox"
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleSelectAll} className="rounded" />
              </th>
              <th className="px-3 py-2 text-left text-sub font-medium text-xs">입금일</th>
              <th className="px-3 py-2 text-left text-sub font-medium text-xs">입금자명</th>
              <th className="px-3 py-2 text-right text-sub font-medium text-xs">금액</th>
              <th className="px-3 py-2 text-center text-sub font-medium text-xs">용도</th>
              <th className="px-3 py-2 text-center text-sub font-medium text-xs">매칭</th>
              <th className="px-3 py-2 text-left text-sub font-medium text-xs">매칭회원</th>
              <th className="px-3 py-2 text-center text-sub font-medium text-xs">옵션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-sub">로딩 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-sub">데이터 없음</td></tr>
            ) : filtered.map(p => (
              <tr key={p.payment_id} className={`border-t border-line hover:bg-soft
                ${!p.matched ? 'bg-red-50/30' : ''} ${selectedIds.has(p.payment_id) ? 'bg-blue-50/50' : ''}`}>
                <td className="px-2 py-2 text-center">
                  <input type="checkbox" checked={selectedIds.has(p.payment_id)}
                    onChange={() => toggleSelect(p.payment_id)} className="rounded" />
                </td>
                <td className="px-3 py-2 text-xs text-sub whitespace-nowrap">
                  {p.paid_at ? new Date(p.paid_at).toLocaleDateString('ko-KR') : '-'}
                </td>
                <td className="px-3 py-2 font-medium">{p.sender_name}</td>
                <td className="px-3 py-2 text-right">{p.amount?.toLocaleString()}원</td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    p.purpose === 'MEMBERSHIP_FEE' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                  }`}>{p.purpose === 'MEMBERSHIP_FEE' ? '등록비' : '참가비'}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    p.matched ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                  }`}>{p.matched ? '✓' : '✗'}</span>
                </td>
                <td className="px-3 py-2 text-xs text-sub">
                  {p.matched_member_id
                    ? members.find(m => m.member_id === p.matched_member_id)?.name || p.matched_member_id
                    : '-'}
                  {p.match_method && <span className="text-[10px] ml-1">({p.match_method})</span>}
                </td>
                {/* ✅ 옵션 칸 - 수동매칭 + 개별 삭제 */}
                <td className="px-3 py-2 text-center">
                  <div className="flex justify-center gap-2">
                    {!p.matched && (
                      <button
                        onClick={() => { setMatchModal(p); setMatchMemberId(''); setMemberSearch('') }}
                        className="text-xs text-accent hover:underline whitespace-nowrap">
                        수동매칭
                      </button>
                    )}
                    <button
                      onClick={() => handleSingleDelete(p)}
                      className="text-xs text-red-500 hover:underline">
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-sub mt-2">총 {filtered.length}건</p>

      {/* 수동매칭 모달 */}
      {matchModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold mb-1">수동 매칭</h3>
            <p className="text-sm text-sub mb-4">
              {matchModal.sender_name} · {matchModal.amount?.toLocaleString()}원
            </p>
            <div className="relative mb-4">
              <label className="block text-xs text-sub mb-1">회원 검색</label>
              <input type="text" value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="이름 또는 ID..."
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
              {matchMemberId && (
                <p className="text-xs text-accent mt-1">
                  선택: {members.find(m => m.member_id === matchMemberId)?.name}
                </p>
              )}
              {filteredMembers.length > 0 && (
                <div className="absolute left-0 right-0 top-full bg-white border border-line rounded-lg shadow-lg mt-1 z-10 max-h-40 overflow-y-auto">
                  {filteredMembers.map(m => (
                    <button key={m.member_id}
                      onClick={() => { setMatchMemberId(m.member_id); setMemberSearch(m.name) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-soft border-b border-line/50">
                      {m.display_name || m.name} ({m.member_id})
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMatchModal(null)}
                className="flex-1 py-2 border border-line rounded-lg text-sm text-sub">취소</button>
              <button onClick={handleManualMatch}
                className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium">매칭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}