import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function PaymentAdmin() {
  const showToast = useContext(ToastContext)
  const [payments, setPayments] = useState([])
  const [members, setMembers] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMatched, setFilterMatched] = useState('')
  const [filterPurpose, setFilterPurpose] = useState('')
  const [uploading, setUploading] = useState(false)

  // 수동매칭 모달
  const [matchModal, setMatchModal] = useState(null)
  const [matchMemberId, setMatchMemberId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')

  // 업로드 폼
  const [uploadPurpose, setUploadPurpose] = useState('MEMBERSHIP_FEE')
  const [uploadEventId, setUploadEventId] = useState('')
  const [uploadYear, setUploadYear] = useState(new Date().getFullYear())

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: pays }, { data: mems }, { data: evts }] = await Promise.all([
      supabase.from('payments').select('*').order('uploaded_at', { ascending: false }).limit(200),
      supabase.from('members').select('member_id, name, display_name').neq('status', '삭제').order('name'),
      supabase.from('events').select('event_id, event_name').order('event_date', { ascending: false }),
    ])
    setPayments(pays || [])
    setMembers(mems || [])
    setEvents(evts || [])
    setLoading(false)
  }

  // CSV 파싱 + 업로드
  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    try {
      const text = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = (e) => resolve(e.target.result); reader.readAsText(file, 'EUC-KR'); })
      const lines = text.split('\n').filter(l => l.trim())
      
      // 헤더 제거 (첫 줄)
      const header = lines[0]
      const rows = lines.slice(1)

      const newPayments = []
      for (const row of rows) {
        // CSV 파싱 (쉼표 구분, 따옴표 처리)
        const cols = row.match(/(".*?"|[^,]+)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) || []
        
        if (cols.length < 3) continue

        // 기본: 날짜, 금액, 입금자명 (파일 형식에 따라 조정 필요)
        const paidAt = cols[0] || null
        const amount = parseInt((cols[1] || '0').replace(/[^0-9-]/g, '')) || 0
        const senderName = cols[2] || ''
        
        if (!senderName || amount <= 0) continue

        const senderNorm = senderName.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase()
        const dedupeKey = `${paidAt}_${amount}_${senderNorm}`

        newPayments.push({
          paid_at: paidAt,
          amount,
          sender_name: senderName,
          sender_name_norm: senderNorm,
          dedupe_key: dedupeKey,
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

      // upsert (dedupe_key 충돌 시 무시)
      const { error } = await supabase.from('payments')
        .upsert(newPayments, { onConflict: 'dedupe_key', ignoreDuplicates: true })

      if (error) {
        showToast?.('업로드 실패: ' + error.message, 'error')
      } else {
        showToast?.(`${newPayments.length}건 업로드 완료! 자동매칭을 시작합니다.`)
        await fetchAll()
        // 자동매칭 실행
        await runAutoMatch()
      }
    } catch (err) {
      showToast?.('파일 처리 오류: ' + err.message, 'error')
    }
    setUploading(false)
    e.target.value = ''
  }

  // 자동매칭 실행
  async function runAutoMatch() {
    const unmatched = payments.filter(p => !p.matched)
    let matchedCount = 0

    for (const pay of unmatched) {
      const { data } = await supabase.rpc('match_payment', { p_payment_id: pay.payment_id })
      if (data?.ok) matchedCount++
    }

    if (matchedCount > 0) {
      showToast?.(`자동매칭: ${matchedCount}건 성공`)
    }
    fetchAll()
  }

  // 수동매칭
  async function handleManualMatch() {
    if (!matchModal || !matchMemberId) {
      showToast?.('회원을 선택해주세요.', 'error')
      return
    }

    const { data, error } = await supabase.rpc('admin_manual_match_payment', {
      p_payment_id: matchModal.payment_id,
      p_member_id: matchMemberId,
      p_entered_by: 'admin',
    })

    if (error || !data?.ok) {
      showToast?.(data?.message || error?.message || '매칭 실패', 'error')
      return
    }

    showToast?.('수동 매칭 완료!')
    setMatchModal(null)
    setMatchMemberId('')
    setMemberSearch('')
    fetchAll()
  }

  const filtered = payments.filter(p => {
    if (filterMatched === 'matched' && !p.matched) return false
    if (filterMatched === 'unmatched' && p.matched) return false
    if (filterPurpose && p.purpose !== filterPurpose) return false
    return true
  })

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

      {/* 업로드 영역 */}
      <div className="bg-white rounded-r border border-line p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">📤 거래내역 업로드</h3>
        <p className="text-xs text-sub mb-3">CSV 파일 형식: 날짜, 금액, 입금자명 (첫 행은 헤더)</p>
        
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
              {events.map(ev => (
                <option key={ev.event_id} value={ev.event_id}>{ev.event_name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-2">
          <label className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-700">
            {uploading ? '업로드 중...' : 'CSV 파일 선택'}
            <input type="file" accept=".csv,.txt" onChange={handleFileUpload}
              className="hidden" disabled={uploading} />
          </label>
          <button onClick={runAutoMatch}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
            🔄 자동매칭 재실행
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
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
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-r border border-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-soft2">
            <tr>
              <th className="px-3 py-2 text-left text-sub font-medium">입금일</th>
              <th className="px-3 py-2 text-left text-sub font-medium">입금자명</th>
              <th className="px-3 py-2 text-right text-sub font-medium">금액</th>
              <th className="px-3 py-2 text-center text-sub font-medium">용도</th>
              <th className="px-3 py-2 text-center text-sub font-medium">매칭</th>
              <th className="px-3 py-2 text-left text-sub font-medium">매칭회원</th>
              <th className="px-3 py-2 text-center text-sub font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-sub">로딩 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-sub">데이터 없음</td></tr>
            ) : filtered.map(p => (
              <tr key={p.payment_id} className={`border-t border-line hover:bg-soft
                ${!p.matched ? 'bg-red-50/30' : ''}`}>
                <td className="px-3 py-2 text-xs text-sub">
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
                  }`}>{p.matched ? '✅' : '❌'}</span>
                </td>
                <td className="px-3 py-2 text-xs text-sub">
                  {p.matched_member_id ? members.find(m => m.member_id === p.matched_member_id)?.name || p.matched_member_id : '-'}
                  {p.match_method && <span className="text-[10px] ml-1">({p.match_method})</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  {!p.matched && (
                    <button onClick={() => { setMatchModal(p); setMatchMemberId(''); setMemberSearch('') }}
                      className="text-xs text-accent hover:underline">수동매칭</button>
                  )}
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
          <div className="bg-white rounded-r2 p-6 w-full max-w-sm">
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
