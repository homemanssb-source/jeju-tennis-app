import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { SkeletonCard } from '../components/Skeleton'

export default function NoticePage() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => { fetchNotices() }, [])

  async function fetchNotices() {
    setLoading(true)
    const { data } = await supabase.from('notices').select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setNotices(data || [])
    setLoading(false)
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  // 상세보기 (대회공지)
  if (selected) {
    const m = selected.meta || {}
    const entryType = m.event_type || 'individual'

    return (
      <div className="pb-20">
        <div className="sticky top-0 bg-white z-10 border-b border-line px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="text-accent text-sm">← 목록</button>
          <span className="text-sm font-semibold truncate flex-1">{selected.title}</span>
        </div>

        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

          {/* 대회명 헤더 */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl p-5 text-white">
            <p className="text-xs font-semibold opacity-80 mb-1">🏆 대회 공지</p>
            <h1 className="text-lg font-black leading-tight">{selected.title}</h1>
            {m.date && <p className="text-sm opacity-90 mt-2">📅 {m.date}</p>}
          </div>

          {/* 기본 정보 카드 */}
          <div className="bg-white rounded-2xl border border-line overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-line">
              <p className="text-xs font-bold text-gray-600">대회 정보</p>
            </div>
            <div className="divide-y divide-line/50">
              {m.venue && <InfoRow icon="📍" label="장소" value={m.venue} />}
              {m.host && <InfoRow icon="🏛" label="주최/주관" value={m.host} />}
              {m.fee && <InfoRow icon="💰" label="참가비" value={m.fee} />}
              {m.account && <InfoRow icon="🏦" label="계좌번호" value={m.account} />}
              {m.deadline && <InfoRow icon="⏰" label="신청마감" value={m.deadline} highlight />}
              {m.contact && <InfoRow icon="📞" label="문의처" value={m.contact} />}
            </div>
          </div>

          {/* 참가신청 버튼 — event_type 기준으로 표시 */}
          {selected.event_id ? (
            <div className="space-y-2">
              {(entryType === 'individual' || entryType === 'both') && (
                <a href="/entry"
                  className="block w-full bg-accent text-white text-center py-3.5 rounded-2xl font-bold text-sm">
                  🎾 개인전 참가신청
                </a>
              )}
              {(entryType === 'team' || entryType === 'both') && (
                <a href="/entry/team"
                  className="block w-full bg-orange-500 text-white text-center py-3.5 rounded-2xl font-bold text-sm">
                  👥 단체전 참가신청
                </a>
              )}
            </div>
          ) : selected.link ? (
            <a href={selected.link} target="_blank" rel="noopener noreferrer"
              className="block w-full bg-accent text-white text-center py-3.5 rounded-2xl font-bold text-sm">
              📝 참가신청 하기
            </a>
          ) : null}

          {/* 부서별 참가자격 — 이미지 있으면 버튼으로 표시 */}
          {m.qualification_image_url ? (
            <QualificationImageSection imageUrl={m.qualification_image_url} />
          ) : m.divisions?.filter(d => d.name).length > 0 ? (
            <div className="bg-white rounded-2xl border border-line overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-line">
                <p className="text-xs font-bold text-gray-600">부서별 참가자격</p>
              </div>
              <div className="divide-y divide-line/50">
                {m.divisions.filter(d => d.name).map((div, idx) => (
                  <div key={idx} className="px-4 py-3 flex gap-3 items-start">
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg shrink-0 min-w-[72px] text-center">
                      {div.name}
                    </span>
                    <p className="text-xs text-gray-600 leading-relaxed flex-1">{div.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* 시상 */}
          {m.prizes && (
            <div className="bg-white rounded-2xl border border-line overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-line">
                <p className="text-xs font-bold text-gray-600">🥇 시상</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{m.prizes}</p>
              </div>
            </div>
          )}

          {/* 경기방법 */}
          {m.rules && (
            <div className="bg-white rounded-2xl border border-line overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-line">
                <p className="text-xs font-bold text-gray-600">📋 경기방법 및 주의사항</p>
              </div>
              <div className="divide-y divide-line/40">
                {m.rules
                  .split('\n')
                  .filter(line => line.trim())
                  .map((line, idx) => {
                    if (line.trim().startsWith('※')) {
                      return (
                        <div key={idx} className="px-4 py-2 bg-amber-50">
                          <p className="text-xs text-amber-700 leading-relaxed">{line.trim()}</p>
                        </div>
                      )
                    }
                    const match = line.trim().match(/^(\d+)\.\s*(.+)/)
                    if (match) {
                      return (
                        <div key={idx} className="flex gap-3 px-4 py-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-600 rounded-full text-xs font-bold flex items-center justify-center mt-0.5">
                            {match[1]}
                          </span>
                          <p className="text-sm text-gray-700 leading-relaxed flex-1">{match[2]}</p>
                        </div>
                      )
                    }
                    return (
                      <div key={idx} className="px-4 py-2">
                        <p className="text-sm text-gray-600 leading-relaxed">{line.trim()}</p>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* 등록일 */}
          <p className="text-xs text-sub text-center">{formatDate(selected.created_at)} 등록</p>
        </div>
      </div>
    )
  }

  // 목록
  return (
    <div className="pb-20">
      <PageHeader title="📢 공지사항" />
      <div className="max-w-lg mx-auto px-4 py-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : notices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm text-sub">등록된 공지가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notices.map(n => (
              n.notice_type === 'tournament'
                ? <TournamentCard key={n.id} n={n} onSelect={setSelected} formatDate={formatDate} />
                : <GeneralCard key={n.id} n={n} formatDate={formatDate} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// 부서별 참가자격 이미지 — 버튼 클릭 시 펼치기/접기
function QualificationImageSection({ imageUrl }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-2xl border border-line overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-line">
        <p className="text-xs font-bold text-gray-600">📋 부서별 참가자격</p>
        <span className="text-xs text-orange-500 font-medium">{open ? '접기 ▲' : '자세히 보기 ▼'}</span>
      </button>
      {open && (
        <div className="p-3">
          <img
            src={imageUrl}
            alt="부서별 참가자격"
            className="w-full object-contain rounded-lg"
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>
      )}
    </div>
  )
}

// 대회공지 카드
function TournamentCard({ n, onSelect, formatDate }) {
  const m = n.meta || {}
  return (
    <button onClick={() => onSelect(n)}
      className="w-full text-left rounded-2xl overflow-hidden border border-orange-200 bg-white hover:shadow-md transition-shadow">
      <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-2.5 flex items-center justify-between">
        <span className="text-xs font-bold text-white">🏆 대회 공지</span>
        {n.pinned && <span className="text-xs text-orange-100">📌 고정</span>}
      </div>
      <div className="px-4 py-3">
        <h3 className="text-sm font-bold text-gray-900 leading-snug">{n.title}</h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {m.date && <span className="text-xs text-gray-500">📅 {m.date}</span>}
          {m.venue && <span className="text-xs text-gray-500">📍 {m.venue}</span>}
        </div>
        {m.divisions?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {m.divisions.filter(d => d.name).slice(0, 4).map((d, i) => (
              <span key={i} className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                {d.name}
              </span>
            ))}
            {m.divisions.filter(d => d.name).length > 4 && (
              <span className="text-xs text-gray-400">+{m.divisions.filter(d => d.name).length - 4}</span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">{formatDate(n.created_at)}</span>
          <span className="text-xs text-orange-500 font-medium">자세히 보기 →</span>
        </div>
      </div>
    </button>
  )
}

// 일반공지 카드
function GeneralCard({ n, formatDate }) {
  return (
    <div className={`rounded-2xl p-4 border transition-colors ${n.pinned ? 'bg-accentSoft border-accent/20' : 'bg-soft border-line/50'}`}>
      <div className="flex items-start gap-2">
        {n.pinned && <span className="text-xs shrink-0 mt-0.5">📌</span>}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{n.title}</h3>
          {n.image_url && (
            <div className="mt-2 rounded-xl overflow-hidden border border-line">
              <img src={n.image_url} alt="첨부이미지" className="w-full object-contain max-h-64"
                onError={e => { e.target.style.display = 'none' }} />
            </div>
          )}
          {n.content && (
            <p className="text-sm text-sub mt-1.5 whitespace-pre-wrap leading-relaxed">{n.content}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[11px] text-sub">{formatDate(n.created_at)}</span>
            {n.link && (
              <a href={n.link} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-accent font-medium hover:underline">
                링크 열기 →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 정보 행 컴포넌트
function InfoRow({ icon, label, value, highlight }) {
  return (
    <div className="px-4 py-3 flex gap-3 items-start">
      <span className="text-sm shrink-0">{icon}</span>
      <span className="text-xs text-gray-400 w-16 shrink-0 mt-0.5">{label}</span>
      <span className={`text-sm flex-1 leading-relaxed ${highlight ? 'text-red-600 font-semibold' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  )
}