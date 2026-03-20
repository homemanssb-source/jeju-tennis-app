import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const navigate = useNavigate()
  const [banners, setBanners] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])

  useEffect(() => {
    fetchBanners()
    fetchUpcomingEvents()
  }, [])

  async function fetchBanners() {
    const { data } = await supabase.from('sponsor_banners')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    setBanners(data || [])
  }

  async function fetchUpcomingEvents() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('events')
      .select('event_name, event_date, event_date_end, status, event_type, entry_open_at, entry_close_at')
      .gte('event_date', today)
      .eq('status', 'OPEN')
      .order('event_date')
      .limit(2)
    setUpcomingEvents(data || [])
  }

  function getDday(dateStr) {
    const diff = Math.ceil((new Date(dateStr) - new Date().setHours(0, 0, 0, 0)) / 86400000)
    if (diff === 0) return 'D-DAY'
    if (diff > 0) return `D-${diff}`
    return `D+${Math.abs(diff)}`
  }

  function getEventTypeLabel(type) {
    if (type === 'team') return '팀전'
    if (type === 'both') return '개인+팀'
    return '개인전'
  }

  // KST 기준 날짜 포맷 (M/D)
  function formatDateMD(utcStr) {
    if (!utcStr) return ''
    return new Date(utcStr).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
    })
  }

  function getEntryStatus(ev) {
    const now = new Date()
    if (ev.entry_open_at && new Date(ev.entry_open_at) > now) return '신청 예정'
    if (ev.entry_close_at && new Date(ev.entry_close_at) < now) return '신청 마감'
    return '신청 중'
  }

  function getEntryStatusColor(ev) {
    const status = getEntryStatus(ev)
    if (status === '신청 중') return '#22c55e'
    if (status === '신청 예정') return '#f59e0b'
    return '#94a3b8'
  }

  return (
    <div className="min-h-screen" style={{ background: '#faf6f1', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif" }}>

      {/* 상단 헤더 */}
      <div style={{ background: '#fff8f3', padding: '22px 20px 18px', borderBottom: '1px solid #f0e8e0' }}>
        <div style={{ maxWidth: 512, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 52, height: 52, background: '#c0612b', borderRadius: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26
            }}>🎾</div>
            <div style={{
              position: 'absolute', bottom: -3, right: -3,
              width: 16, height: 16, background: '#fbbf24',
              borderRadius: 6, border: '2.5px solid #fff8f3'
            }} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#2d1a0e', letterSpacing: -0.8, lineHeight: 1 }}>
              J.T.A <span style={{ color: '#c0612b' }}>제주</span>
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 10, color: '#c8a898', letterSpacing: 2.5, fontWeight: 600 }}>
              JEJUSI TENNIS ASSOCIATION
            </p>
          </div>
          <div style={{ background: '#c0612b', borderRadius: 12, padding: '5px 14px', textAlign: 'center', flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, fontWeight: 700 }}>SEASON</p>
            <p style={{ margin: 0, fontSize: 18, color: '#fff', fontWeight: 900, lineHeight: 1.1 }}>2026</p>
          </div>
        </div>
      </div>

      {/* 바디 */}
      <div style={{ maxWidth: 512, margin: '0 auto', padding: '16px 16px 80px' }}>

        {/* 대회 일정 (최대 2개) */}
        {upcomingEvents.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {upcomingEvents.map((ev, idx) => {
              const isFirst = idx === 0
              return (
                <div
                  key={ev.event_date + ev.event_name}
                  onClick={() => navigate('/notice')}
                  style={{
                    background: '#fff',
                    borderRadius: 22,
                    padding: '13px 18px',
                    marginBottom: isFirst && upcomingEvents.length > 1 ? 7 : 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: isFirst
                      ? '0 2px 0 rgba(192,97,43,0.08), 0 8px 24px rgba(192,97,43,0.07)'
                      : '0 1px 0 rgba(192,97,43,0.04), 0 4px 12px rgba(192,97,43,0.04)',
                    cursor: 'pointer',
                    borderLeft: isFirst ? '3px solid #c0612b' : '3px solid #e8ddd8',
                    opacity: isFirst ? 1 : 0.75,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      background: isFirst ? '#c0612b' : '#e8ddd8',
                      borderRadius: 10,
                      padding: '4px 11px',
                      flexShrink: 0,
                    }}>
                      <span style={{
                        fontSize: isFirst ? 12 : 11,
                        fontWeight: 700,
                        color: isFirst ? '#fff' : '#a07060',
                      }}>{getDday(ev.event_date)}</span>
                    </div>
                    <div>
                      <p style={{
                        margin: 0,
                        fontSize: isFirst ? 13 : 12,
                        fontWeight: isFirst ? 700 : 600,
                        color: isFirst ? '#2d1a0e' : '#7a6a62',
                      }}>{ev.event_name}</p>
                      {/* 대회일 + 접수기간 가로 배치 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                        {/* 대회일 */}
                        <span style={{ fontSize: 10, color: '#c8a898' }}>
                          🗓 {ev.event_date}{ev.event_date_end ? ` ~ ${ev.event_date_end.slice(5).replace('-', '/')}` : ''}
                        </span>
                        {/* 구분선 */}
                        {(ev.entry_open_at || ev.entry_close_at) && (
                          <span style={{ fontSize: 10, color: '#e0d8d0' }}>|</span>
                        )}
                        {/* 접수기간 */}
                        {(ev.entry_open_at || ev.entry_close_at) && (
                          <span style={{ fontSize: 10, color: '#c8a898' }}>
                            📝 {formatDateMD(ev.entry_open_at)} ~ {formatDateMD(ev.entry_close_at)}
                          </span>
                        )}
                        {/* 신청 상태 뱃지 (첫번째 대회만) */}
                        {isFirst && (
                          <span style={{
                            fontSize: 9, fontWeight: 600,
                            color: getEntryStatusColor(ev),
                            background: getEntryStatus(ev) === '신청 중' ? '#f0fdf4'
                              : getEntryStatus(ev) === '신청 예정' ? '#fffbeb' : '#f8fafc',
                            padding: '1px 5px', borderRadius: 4,
                          }}>
                            {getEntryStatus(ev)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span style={{ color: '#ddd', fontSize: 20 }}>›</span>
                </div>
              )
            })}
          </div>
        )}

        {/* 메인 바로가기 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <button
            onClick={() => navigate('/ranking')}
            style={{
              background: '#fff', borderRadius: 22, padding: '20px 16px', textAlign: 'left',
              border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 0 rgba(192,97,43,0.06), 0 8px 24px rgba(192,97,43,0.06)',
              transition: 'transform 0.15s'
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onTouchStart={e => e.currentTarget.style.transform = 'scale(0.98)'}
            onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}>
            <div style={{
              width: 44, height: 44, borderRadius: 16, background: '#fef3ec',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12
            }}>🏆</div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#2d1a0e' }}>랭킹 / 참가</p>
            <p style={{ margin: '3px 0 0', fontSize: 10, color: '#c0612b' }}>순위조회 · 참가신청</p>
          </button>

          <a
            href="https://jeju-tournament.vercel.app/"
            target="_blank" rel="noopener noreferrer"
            style={{
              background: '#fff', borderRadius: 22, padding: '20px 16px', textAlign: 'left',
              textDecoration: 'none', display: 'block',
              boxShadow: '0 2px 0 rgba(192,97,43,0.06), 0 8px 24px rgba(192,97,43,0.06)',
              transition: 'transform 0.15s'
            }}>
            <div style={{
              width: 44, height: 44, borderRadius: 16, background: '#fffbeb',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12
            }}>🎯</div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#2d1a0e' }}>대회 운영</p>
            <p style={{ margin: '3px 0 0', fontSize: 10, color: '#d97706' }}>대진표·결과표 · 조편성</p>
          </a>
        </div>

        {/* 퀵 메뉴 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 28 }}>
          {[
            { icon: '👤', label: '개인전\n참가', path: '/entry' },
            { icon: '👥', label: '팀전\n참가', path: '/entry/team' },
            { icon: '📢', label: '공지\n사항', path: '/notice' },
            { icon: '🔍', label: '선수\n검색', path: '/search' },
          ].map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                background: '#fff', borderRadius: 18, padding: '14px 6px', textAlign: 'center',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 2px 0 rgba(192,97,43,0.05), 0 4px 14px rgba(192,97,43,0.05)',
                transition: 'transform 0.15s'
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              onTouchStart={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}>
              <span style={{ fontSize: 22, display: 'block', marginBottom: 5 }}>{item.icon}</span>
              <span style={{ fontSize: 9, color: '#c8a898', whiteSpace: 'pre-line', lineHeight: 1.4 }}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* 업체 정보 배너 */}
        {banners.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ height: 1, flex: 1, background: '#f0e8e0' }} />
              <span style={{ fontSize: 10, color: '#e0cfc7', letterSpacing: 3, fontWeight: 700 }}>SPONSORS</span>
              <div style={{ height: 1, flex: 1, background: '#f0e8e0' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {banners.map(b => (
                <a
                  key={b.id}
                  href={b.link_url || '#'}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    background: '#fff', borderRadius: 20, overflow: 'hidden',
                    textDecoration: 'none', display: 'block',
                    boxShadow: '0 2px 0 rgba(192,97,43,0.05), 0 6px 18px rgba(192,97,43,0.05)',
                    transition: 'transform 0.15s'
                  }}>
                  {b.image_url ? (
                    <div style={{ aspectRatio: '16/9', overflow: 'hidden' }}>
                      <img
                        src={b.image_url} alt={b.company_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      />
                    </div>
                  ) : (
                    <div style={{
                      aspectRatio: '16/9', background: '#faf6f1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12, background: '#c0612b',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 16, fontWeight: 900,
                      }}>
                        {b.company_name?.charAt(0) || '🎾'}
                      </div>
                    </div>
                  )}
                  <div style={{ padding: '10px 12px' }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#2d1a0e' }} className="truncate">{b.company_name}</p>
                    {b.description && (
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: '#c8a898' }} className="truncate">{b.description}</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 푸터 */}
        <div style={{ textAlign: 'center', paddingTop: 20, borderTop: '1px solid #f0e8e0' }}>
          <p style={{ fontSize: 11, color: '#ddd', margin: 0 }}>© 2026 J.T.A 제주 · 제주시테니스협회</p>
        </div>
      </div>
    </div>
  )
}