import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const navigate = useNavigate()
  const [banners, setBanners] = useState([])
  const [nextEvent, setNextEvent] = useState(null)

  useEffect(() => {
    fetchBanners()
    fetchNextEvent()
  }, [])

  async function fetchBanners() {
    const { data } = await supabase.from('sponsor_banners')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    setBanners(data || [])
  }

  async function fetchNextEvent() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('events')
      .select('event_name, event_date, status, event_type')
      .gte('event_date', today)
      .eq('status', 'OPEN')
      .order('event_date')
      .limit(1)
    if (data?.length > 0) setNextEvent(data[0])
  }

  function getDday(dateStr) {
    const diff = Math.ceil((new Date(dateStr) - new Date().setHours(0,0,0,0)) / 86400000)
    if (diff === 0) return 'D-DAY'
    if (diff > 0) return `D-${diff}`
    return `D+${Math.abs(diff)}`
  }

  return (
    <div className="min-h-screen" style={{ background: '#faf6f1', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif" }}>

      {/* ── 헤더: 사이드 레이아웃 (Variant C) ── */}
      <div style={{ background: '#fff8f3', padding: '22px 20px 18px', borderBottom: '1px solid #f0e8e0' }}>
        <div style={{ maxWidth: 512, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>

          {/* 로고 박스 */}
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

          {/* 텍스트 */}
          <div style={{ flex: 1 }}>
            <h1 style={{
              margin: 0, fontSize: 22, fontWeight: 900, color: '#2d1a0e',
              letterSpacing: -0.8, lineHeight: 1
            }}>
              J.T.A <span style={{ color: '#c0612b' }}>랭킹</span>
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 10, color: '#c8a898', letterSpacing: 2.5, fontWeight: 600 }}>
              JEJUSI TENNIS ASSOCIATION
            </p>
          </div>

          {/* 시즌 뱃지 */}
          <div style={{
            background: '#c0612b', borderRadius: 12,
            padding: '5px 14px', textAlign: 'center', flexShrink: 0
          }}>
            <p style={{ margin: 0, fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, fontWeight: 700 }}>SEASON</p>
            <p style={{ margin: 0, fontSize: 18, color: '#fff', fontWeight: 900, lineHeight: 1.1 }}>2026</p>
          </div>
        </div>
      </div>

      {/* ── 바디 ── */}
      <div style={{ maxWidth: 512, margin: '0 auto', padding: '16px 16px 80px' }}>

        {/* 다음 대회 D-day */}
        {nextEvent && (
          <div
            onClick={() => navigate('/notice')}
            style={{
              background: '#fff', borderRadius: 22, padding: '15px 18px', marginBottom: 14,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              boxShadow: '0 2px 0 rgba(192,97,43,0.08), 0 8px 24px rgba(192,97,43,0.07)',
              cursor: 'pointer'
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: '#c0612b', borderRadius: 10, padding: '5px 13px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{getDday(nextEvent.event_date)}</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#2d1a0e' }}>{nextEvent.event_name}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#c8a898' }}>{nextEvent.event_date}</p>
              </div>
            </div>
            <span style={{ color: '#ddd', fontSize: 20 }}>›</span>
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
            <p style={{ margin: '3px 0 0', fontSize: 10, color: '#c0612b' }}>랭킹조회 · 참가신청</p>
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
            }}>📊</div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#2d1a0e' }}>대회 운영</p>
            <p style={{ margin: '3px 0 0', fontSize: 10, color: '#d97706' }}>실시간 스코어 · 대진표</p>
          </a>
        </div>

        {/* 퀵 메뉴 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 28 }}>
          {[
            { icon: '📝', label: '개인전\n참가', path: '/entry' },
            { icon: '🏟️', label: '단체전\n참가', path: '/entry/team' },
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

        {/* 업체 홍보 배너 */}
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
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28
                    }}>🏢</div>
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
          <p style={{ fontSize: 11, color: '#ddd', margin: 0 }}>© 2026 J.T.A랭킹 · 제주시 테니스 협회</p>
        </div>
      </div>
    </div>
  )
}