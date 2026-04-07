// src/pages/admin/EntryAdmin.jsx
import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function EntryAdmin() {
  const showToast = useContext(ToastContext)
  const [events, setEvents]           = useState([])
  const [entries, setEntries]         = useState([])       // 媛쒖씤??  const [teamEntries, setTeamEntries] = useState([])       // ?⑥껜??  const [selectedEventId, setSelectedEventId] = useState('')
  const [filterPayment, setFilterPayment]     = useState('')
  const [filterType, setFilterType]           = useState('')
  const [filterName, setFilterName]           = useState('')  // ???대쫫 寃??  const [loading, setLoading]                 = useState(false)

  // ?? 痍⑥냼 ?뺤씤 紐⑤떖 (愿由ъ옄) ??
  const [confirmModal, setConfirmModal] = useState(null) // { message, onConfirm }

  // ?? ?섎텋 泥섎━ 紐⑤떖 ??
  const [refundModal, setRefundModal] = useState(null) // entry 媛앹껜 (_raw ?ы븿)
  const [refunding, setRefunding]     = useState(false)

  useEffect(() => { fetchEvents() }, [])
  useEffect(() => {
    if (selectedEventId) { fetchEntries(); fetchTeamEntries() }
  }, [selectedEventId])

  async function fetchEvents() {
    const { data } = await supabase.from('events')
      .select('*').order('event_date', { ascending: false })
    setEvents(data || [])
  }

  async function fetchEntries() {
    setLoading(true)
    // ?쇰컲 ?좎껌 嫄?(痍⑥냼 ?쒖쇅)
    const { data: normalData } = await supabase
      .from('event_entries')
      .select('*, teams ( team_id, team_name, member1_id, member2_id ), event_divisions ( division_name )')
      .eq('event_id', selectedEventId)
      .neq('entry_status', '痍⑥냼')
      .order('applied_at', { ascending: false })

    // ?섎텋?湲??섎텋?꾨즺 嫄?(痍⑥냼?먯?留?愿由ъ옄媛 泥섎━?댁빞 ??嫄?
    const { data: refundData } = await supabase
      .from('event_entries')
      .select('*, teams ( team_id, team_name, member1_id, member2_id ), event_divisions ( division_name )')
      .eq('event_id', selectedEventId)
      .eq('entry_status', '痍⑥냼')
      .in('payment_status', ['?섎텋?湲?, '?섎텋?꾨즺'])
      .order('applied_at', { ascending: false })

    const merged = [
      ...(normalData || []),
      ...(refundData || []),
    ]

    // ??member_id 紐⑸줉 ?섏쭛 ??members ?뚯씠釉붿뿉??club ?쒕쾲??議고쉶
    const memberIds = [...new Set(
      merged.flatMap(e => [e.teams?.member1_id, e.teams?.member2_id].filter(Boolean))
    )]
    let memberClubMap = {}
    if (memberIds.length > 0) {
      const { data: membersData } = await supabase
        .from('members')
        .select('member_id, name, club')
        .in('member_id', memberIds)
      for (const m of (membersData || [])) {
        memberClubMap[m.member_id] = { name: m.name, club: m.club }
      }
    }
    // ??媛?entry??club ?뺣낫 泥⑤?
    for (const e of merged) {
      e._m1 = e.teams?.member1_id ? memberClubMap[e.teams.member1_id] : null
      e._m2 = e.teams?.member2_id ? memberClubMap[e.teams.member2_id] : null
    }

    setEntries(merged)
    setLoading(false)
  }

  async function fetchTeamEntries() {
    const { data } = await supabase
      .from('team_event_entries')
      .select('*')
      .eq('event_id', selectedEventId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
    setTeamEntries(data || [])
  }

  // ?? ?듯빀 紐⑸줉 ??
  const allEntries = [
    ...entries.map(e => {
      // ??"?띻만???쒖＜?섎굹)/?띻만湲??쒖＜?꾨씪)" ?뺤떇 議고빀
      const p1 = e._m1 ? (e._m1.club ? `${e._m1.name}(${e._m1.club})` : e._m1.name) : ''
      const p2 = e._m2 ? (e._m2.club ? `${e._m2.name}(${e._m2.club})` : e._m2.name) : ''
      const displayName = p1 && p2 ? `${p1}/${p2}` : (p1 || e.teams?.team_name || '-')
      return {
        id:             e.entry_id,
        type:           '媛쒖씤',
        name:           displayName,
        division:       e.event_divisions?.division_name || '-',
        status:         e.entry_status,
        payment_status: e.payment_status,
        date:           e.applied_at,
        _source:        'individual',
        _raw:           e,
      }
    }),
    ...teamEntries.map(e => ({
      id:             e.id,
      type:           '?⑥껜',
      name:           e.club_name || '-',
      division:       e.division_name || '-',
      status:         e.status === 'confirmed' ? '?뺤젙' : e.status === 'pending' ? '?湲? : e.status,
      payment_status: e.payment_status || '誘몃궔',
      date:           e.created_at,
      _source:        'team',
      _raw:           e,
    })),
  ]

  // 痍⑥냼 嫄??쒖쇅??移댁슫??湲곗? 紐⑸줉
  const activeEntries = allEntries.filter(e =>
    e.status !== '痍⑥냼' && e.payment_status !== '?섎텋?꾨즺'
  )

  const totalCount   = activeEntries.length
  const paidCount    = activeEntries.filter(e => e.payment_status === '寃곗젣?꾨즺').length
  const unpaidCount  = activeEntries.filter(e => e.payment_status === '誘몃궔').length
  const refundCount  = allEntries.filter(e => e.payment_status === '?섎텋?湲?).length

  // ???꾪꽣 ?곸슜 (?대쫫 寃???ы븿)
  const filtered = allEntries.filter(e => {
    if (filterPayment && e.payment_status !== filterPayment) return false
    if (filterType === '媛쒖씤' && e.type !== '媛쒖씤') return false
    if (filterType === '?⑥껜' && e.type !== '?⑥껜') return false
    if (filterName.trim() && !e.name.toLowerCase().includes(filterName.trim().toLowerCase())) return false
    return true
  })

  // ?? 寃곗젣 ?곹깭 蹂寃???
  async function handlePaymentSet(entry, status) {
    if (entry._source === 'individual') {
      await supabase.from('event_entries')
        .update({ payment_status: status, paid_at: status === '寃곗젣?꾨즺' ? new Date().toISOString() : null })
        .eq('entry_id', entry.id)
    } else {
      await supabase.from('team_event_entries')
        .update({ payment_status: status, paid_at: status === '寃곗젣?꾨즺' ? new Date().toISOString() : null })
        .eq('id', entry.id)
    }
    showToast?.('寃곗젣 ?곹깭 蹂寃? ' + status)
    fetchEntries(); fetchTeamEntries()
  }

  // ?? ?좎껌 痍⑥냼 (愿由ъ옄) ??
  function handleCancelConfirm(entry) {
    setConfirmModal({
      message: `"${entry.name}" ?좎껌??痍⑥냼?섏떆寃좎뒿?덇퉴?`,
      onConfirm: async () => {
        if (entry._source === 'individual') {
          await supabase.from('event_entries')
            .update({ entry_status: '痍⑥냼', cancelled_at: new Date().toISOString() })
            .eq('entry_id', entry.id)
        } else {
          await supabase.from('team_event_entries')
            .update({ status: 'cancelled' })
            .eq('id', entry.id)
        }
        showToast?.('?좎껌 痍⑥냼??)
        setConfirmModal(null)
        fetchEntries(); fetchTeamEntries()
      }
    })
  }

  // ?? ?섎텋 ?꾨즺 泥섎━ ??
  async function handleRefundComplete() {
    if (!refundModal) return
    setRefunding(true)
    const { error } = await supabase.from('event_entries')
      .update({
        payment_status:      '?섎텋?꾨즺',
        refund_completed_at: new Date().toISOString(),
      })
      .eq('entry_id', refundModal.id)

    setRefunding(false)
    if (error) { showToast?.('?섎텋 泥섎━ ?ㅽ뙣: ' + error.message, 'error'); return }
    showToast?.('???섎텋 ?꾨즺 泥섎━?섏뿀?듬땲??')
    setRefundModal(null)
    fetchEntries()
  }

  function formatDate(str) {
    if (!str) return '-'
    return new Date(str).toLocaleDateString('ko-KR')
  }

  function payBadgeClass(status) {
    if (status === '寃곗젣?꾨즺') return 'bg-green-50 text-green-700'
    if (status === '?꾩옣?⑸?') return 'bg-yellow-50 text-yellow-700'
    if (status === '?섎텋?湲?) return 'bg-orange-50 text-orange-700'
    if (status === '?섎텋?꾨즺') return 'bg-gray-100 text-gray-500'
    return 'bg-red-50 text-red-600'
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">?뱥 李멸??좎껌 愿由?/h2>

      {/* ????좏깮 + ?좏삎/寃곗젣 ?꾪꽣 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={selectedEventId}
          onChange={e => { setSelectedEventId(e.target.value); setEntries([]); setTeamEntries([]) }}
          className="flex-1 min-w-[200px] text-sm border border-line rounded-lg px-3 py-2">
          <option value="">????좏깮</option>
          {events.map(ev => (
            <option key={ev.event_id} value={ev.event_id}>
              {ev.event_name} ({ev.event_date})
            </option>
          ))}
        </select>

        {/* ???대쫫 寃??*/}
        <input
          type="text"
          value={filterName}
          onChange={e => setFilterName(e.target.value)}
          placeholder="?대쫫 寃??.."
          className="text-sm border border-line rounded-lg px-3 py-2 w-32"
        />

        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">?꾩껜 ?좏삎</option>
          <option value="媛쒖씤">媛쒖씤?꾨쭔</option>
          <option value="?⑥껜">?⑥껜?꾨쭔</option>
        </select>
        <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">?꾩껜 寃곗젣?곹깭</option>
          <option value="誘몃궔">誘몃궔留?/option>
          <option value="寃곗젣?꾨즺">寃곗젣?꾨즺留?/option>
          <option value="?꾩옣?⑸?">?꾩옣?⑸?</option>
          <option value="?섎텋?湲?>?섎텋?湲곕쭔</option>
          <option value="?섎텋?꾨즺">?섎텋?꾨즺留?/option>
        </select>
      </div>

      {/* ?? 移댁슫?????? */}
      {selectedEventId && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setFilterPayment('')}
            className={`px-3 py-2 rounded-lg text-left transition-colors ${
              filterPayment === '' ? 'bg-accent text-white' : 'bg-soft text-gray-700 hover:bg-soft2'
            }`}>
            <p className="text-[10px] opacity-80">?꾩껜</p>
            <p className="text-lg font-bold">{totalCount}?</p>
          </button>
          <button
            onClick={() => setFilterPayment(filterPayment === '寃곗젣?꾨즺' ? '' : '寃곗젣?꾨즺')}
            className={`px-3 py-2 rounded-lg text-left transition-colors ${
              filterPayment === '寃곗젣?꾨즺' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}>
            <p className="text-[10px] opacity-80">寃곗젣?꾨즺</p>
            <p className="text-lg font-bold">{paidCount}?</p>
          </button>
          <button
            onClick={() => setFilterPayment(filterPayment === '誘몃궔' ? '' : '誘몃궔')}
            className={`px-3 py-2 rounded-lg text-left transition-colors ${
              filterPayment === '誘몃궔' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}>
            <p className="text-[10px] opacity-80">誘몃궔</p>
            <p className="text-lg font-bold">{unpaidCount}?</p>
          </button>
          {refundCount > 0 && (
            <button
              onClick={() => setFilterPayment(filterPayment === '?섎텋?湲? ? '' : '?섎텋?湲?)}
              className={`px-3 py-2 rounded-lg text-left transition-colors ${
                filterPayment === '?섎텋?湲?
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
              }`}>
              <p className="text-[10px] opacity-80">?섎텋?湲?/p>
              <p className="text-lg font-bold">{refundCount}?</p>
            </button>
          )}
        </div>
      )}

      {/* ?? ?뷀듃由?紐⑸줉 ?? */}
      {!selectedEventId ? (
        <p className="text-center py-8 text-sub text-sm">??뚮? ?좏깮?댁＜?몄슂.</p>
      ) : loading ? (
        <p className="text-center py-8 text-sub text-sm">濡쒕뵫 以?..</p>
      ) : (
        <div className="bg-white rounded-r border border-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-soft2">
              <tr>
                <th className="px-3 py-2 text-center text-sub font-medium">?좏삎</th>
                <th className="px-3 py-2 text-left text-sub font-medium">遺??/th>
                <th className="px-3 py-2 text-left text-sub font-medium">?/?대읇</th>
                <th className="px-3 py-2 text-center text-sub font-medium">?곹깭</th>
                <th className="px-3 py-2 text-center text-sub font-medium">寃곗젣</th>
                <th className="px-3 py-2 text-left text-sub font-medium">?좎껌??/th>
                <th className="px-3 py-2 text-center text-sub font-medium">?≪뀡</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-sub">?좎껌 ?댁뿭 ?놁쓬</td>
                </tr>
              ) : filtered.map(e => (
                <tr
                  key={`${e._source}-${e.id}`}
                  className={`border-t border-line hover:bg-soft ${
                    e.payment_status === '?섎텋?湲? ? 'bg-orange-50/40' : ''
                  }`}>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      e.type === '?⑥껜' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>{e.type}</span>
                  </td>
                  <td className="px-3 py-2">{e.division}</td>
                  <td className="px-3 py-2 font-medium">{e.name}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                      {e.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${payBadgeClass(e.payment_status)}`}>
                      {e.payment_status || '誘몃궔'}
                    </span>
                    {/* ?섎텋?湲? 怨꾩쥖 ?뺣낫 誘몃━蹂닿린 */}
                    {e.payment_status === '?섎텋?湲? && e._raw && (
                      <div className="text-[10px] text-orange-700 mt-0.5 text-left">
                        {e._raw.refund_bank} {e._raw.refund_account}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-sub">
                    {e.date ? new Date(e.date).toLocaleDateString('ko-KR') : '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {/* ?섎텋?湲????섎텋 泥섎━ 踰꾪듉留??쒖떆 */}
                      {e.payment_status === '?섎텋?湲? ? (
                        <button
                          onClick={() => setRefundModal(e)}
                          className="text-xs text-orange-600 border border-orange-200 bg-orange-50
                            hover:bg-orange-100 rounded px-2 py-0.5 font-medium">
                          ?섎텋 泥섎━
                        </button>
                      ) : e.payment_status === '?섎텋?꾨즺' ? (
                        <span className="text-xs text-gray-400">?꾨즺</span>
                      ) : (
                        <>
                          {e.payment_status !== '寃곗젣?꾨즺' && (
                            <button onClick={() => handlePaymentSet(e, '寃곗젣?꾨즺')}
                              className="text-xs text-green-600 hover:underline">寃곗젣?뺤씤</button>
                          )}
                          {e.payment_status !== '?꾩옣?⑸?' && e.payment_status !== '寃곗젣?꾨즺' && (
                            <button onClick={() => handlePaymentSet(e, '?꾩옣?⑸?')}
                              className="text-xs text-yellow-600 hover:underline">?꾩옣?⑸?</button>
                          )}
                          <button onClick={() => handleCancelConfirm(e)}
                            className="text-xs text-red-500 hover:underline">痍⑥냼</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ?? 愿由ъ옄 痍⑥냼 ?뺤씤 紐⑤떖 ?? */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm z-10">
            <p className="text-sm text-gray-800 mb-5 whitespace-pre-line">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">
                痍⑥냼
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600">
                ?뺤씤
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ?? ?섎텋 泥섎━ 紐⑤떖 ?? */}
      {refundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRefundModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm z-10">
            <h3 className="text-base font-semibold text-gray-900 mb-4">?섎텋 泥섎━ ?뺤씤</h3>

            {/* ?좎껌 ?뺣낫 */}
            <div className="bg-soft rounded-xl px-4 py-3 mb-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-sub">?뚯썝</span>
                <span className="font-medium">{refundModal.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-sub">遺??/span>
                <span>{refundModal.division}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-sub">?좎껌??/span>
                <span>{formatDate(refundModal.date)}</span>
              </div>
              {refundModal._raw?.refund_requested_at && (
                <div className="flex justify-between text-xs">
                  <span className="text-sub">痍⑥냼 ?좎껌??/span>
                  <span>{formatDate(refundModal._raw.refund_requested_at)}</span>
                </div>
              )}
            </div>

            {/* ?섎텋 怨꾩쥖 */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-5 space-y-1.5">
              <p className="text-xs font-semibold text-orange-800 mb-1">?섎텋 怨꾩쥖 (?뚯썝 ?낅젰)</p>
              <div className="flex justify-between text-xs">
                <span className="text-orange-700">???/span>
                <span className="font-medium text-orange-900">{refundModal._raw?.refund_bank || '-'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-orange-700">怨꾩쥖踰덊샇</span>
                <span className="font-medium text-orange-900">{refundModal._raw?.refund_account || '-'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-orange-700">?덇툑二?/span>
                <span className="font-medium text-orange-900">{refundModal._raw?.refund_holder || '-'}</span>
              </div>
            </div>

            <p className="text-xs text-sub mb-5 leading-relaxed">
              ??怨꾩쥖濡??섎텋 ?낃툑 ??"?섎텋 ?꾨즺" 踰꾪듉???뚮윭二쇱꽭??
              泥섎━ ??寃곗젣 ?곹깭媛 "?섎텋?꾨즺"濡?蹂寃쎈맗?덈떎.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setRefundModal(null)}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">
                ?リ린
              </button>
              <button
                onClick={handleRefundComplete}
                disabled={refunding}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold
                  hover:bg-green-700 disabled:opacity-50">
                {refunding ? '泥섎━ 以?..' : '?섎텋 ?꾨즺 泥섎━'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
