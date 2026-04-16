// src/pages/HomePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NotificationBell from '../components/NotificationBell'

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
      .in('status', ['OPEN', 'CLOSED'])
      .order('event_date')
      .limit(2)
    setUpcomingEvents(data || [])
  }

  function getDday(dateStr) {
    const eventDay = new Date(dateStr + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const diff = Math.ceil((eventDay - today) / 86400000)
    if (diff === 0) return 'D-DAY'
    if (diff > 0) return `D-${diff}`
    return `D+${Math.abs(diff)}`
  }

  function getEventTypeLabel(type) {
    if (type === 'team') return '팀전'
    if (type === 'both') return '개인+팀'
    return '개인전'
  }

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
    if (ev.entry_open_at && new Date(ev.entry_open_at) > now) return '접수 예정'
    if (ev.entry_close_at && new Date(ev.entry_close_at) < now) return '접수 마감'
    return '접수 중'
  }

  function getEntryStatusColor(ev) {
    const status = getEntryStatus(ev)
    if (status === '접수 중') return '#22c55e'
    if (status === '접수 예정') return '#f59e0b'
    return '#94a3b8'
  }

  return (
    <div className="min-h-screen" style={{ background: '#faf6f1', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", overflowX: 'hidden' }}>

      {/* 상단 헤더 */}
      <div style={{ background: '#fff8f3', padding: '22px 20px 18px', borderBottom: '1px solid #f0e8e0' }}>
        <div style={{ maxWidth: 512, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14, overflow: 'hidden' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#2d1a0e', letterSpacing: -0.8, lineHeight: 1 }}>
              J.T.A <span style={{ color: '#c0612b' }}>제주</span>
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 10, color: '#c8a898', letterSpacing: 2.5, fontWeight: 600 }}>
              JEJUSI TENNIS ASSOCIATION
            </p>
          </div>
          <NotificationBell />
          <div style={{ background: '#c0612b', borderRadius: 12, padding: '5px 10px', textAlign: 'center', flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, fontWeight: 700 }}>SEASON</p>
            <p style={{ margin: 0, fontSize: 18, color: '#fff', fontWeight: 900, lineHeight: 1.1 }}>2026</p>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div style={{ maxWidth: 512, margin: '0 auto', padding: '16px 16px 80px' }}>

        {/* 다가오는 대회 */}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{
                      background: isFirst ? '#c0612b' : '#e8ddd8',
                      borderRadius: 10, padding: '4px 11px', flexShrink: 0,
                    }}>
                      <span style={{
                        fontSize: isFirst ? 12 : 11, fontWeight: 700,
                        color: isFirst ? '#fff' : '#a07060',
                      }}>{getDday(ev.event_date)}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        margin: 0, fontSize: isFirst ? 13 : 12,
                        fontWeight: isFirst ? 700 : 600,
                        color: isFirst ? '#2d1a0e' : '#7a6a62',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{ev.event_name}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: '#c8a898' }}>
                          📅 {ev.event_date}{ev.event_date_end ? ` ~ ${ev.event_date_end.slice(5).replace('-', '/')}` : ''}
                        </span>
                        {(ev.entry_open_at || ev.entry_close_at) && (
                          <span style={{ fontSize: 10, color: '#e0d8d0' }}>|</span>
                        )}
                        {(ev.entry_open_at || ev.entry_close_at) && (
                          <span style={{ fontSize: 10, color: '#c8a898' }}>
                            📝 {formatDateMD(ev.entry_open_at)} ~ {formatDateMD(ev.entry_close_at)}
                          </span>
                        )}
                        {isFirst && (
                          <span style={{
                            fontSize: 9, fontWeight: 600,
                            color: getEntryStatusColor(ev),
                            background: getEntryStatus(ev) === '접수 중' ? '#f0fdf4'
                              : getEntryStatus(ev) === '접수 예정' ? '#fffbeb' : '#f8fafc',
                            padding: '1px 5px', borderRadius: 4,
                          }}>
                            {getEntryStatus(ev)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span style={{ color: '#ddd', fontSize: 20, flexShrink: 0 }}>›</span>
                </div>
              )
            })}
          </div>
        )}

        {/* 메인 바로가기 2칸 */}
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
            <p style={{ margin: '3px 0 0', fontSize: 10, color: '#d97706' }}>대진표·결과표·조편성</p>
          </a>
        </div>

        {/* 퀵 버튼 4칸 — 건의문의·신청확인·회원등록·선수검색 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 28 }}>
          {[
            { icon: '💬', label: '건의\n문의',   path: '/board' },
            { icon: '📋', label: '신청\n확인',   path: '/apply' },
            { icon: '👤', label: '회원\n등록',   path: '/register' },
            { icon: '🔍', label: '선수\n검색',   path: '/search' },
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

        {/* 스폰서 배너 */}
        {banners.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ height: 1, flex: 1, background: '#f0e8e0' }} />
              <span style={{ fontSize: 9, color: '#d4c4bc', letterSpacing: 3, fontWeight: 700 }}>SPONSORS</span>
              <div style={{ height: 1, flex: 1, background: '#f0e8e0' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {banners.map(b => (
                <a
                  key={b.id}
                  href={b.link_url || '#'}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    textDecoration: 'none', padding: '8px 4px', borderRadius: 12, background: '#fff',
                    transition: 'opacity 0.15s', minWidth: 0,
                  }}
                  onTouchStart={e => e.currentTarget.style.opacity = '0.7'}
                  onTouchEnd={e => e.currentTarget.style.opacity = '1'}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: b.image_url ? 'transparent' : '#f0f0f0',
                    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {b.image_url
                      ? <img src={b.image_url} alt={b.company_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 15, fontWeight: 900, color: '#c0612b' }}>{b.company_name?.charAt(0) || '?'}</span>
                    }
                  </div>
                  <p style={{
                    margin: 0, fontSize: 9, fontWeight: 600,
                    color: '#b0a8a0', textAlign: 'center', lineHeight: 1.3, wordBreak: 'keep-all',
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>{b.company_name}</p>
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
