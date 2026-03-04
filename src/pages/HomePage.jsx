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
    <div className="min-h-screen" style={{ background: '#fffbeb' }}>
      {/* 상단 헤더 */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' }}>
        <div className="absolute -top-5 -right-5 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        <div className="absolute -bottom-8 -left-3 w-20 h-20 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="relative max-w-lg mx-auto px-5 pt-12 pb-9 text-center">
          <span className="text-5xl block mb-2">🎾</span>
          <h1 className="text-3xl font-black tracking-tight text-gray-800 mb-1">
            J.T.A<span className="text-gray-900">랭킹</span>
          </h1>
          <p className="text-xs tracking-widest uppercase" style={{ color: '#92400e' }}>
            Jejusi Tennis Association
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 -mt-4 relative pb-6">
        {/* 다음 대회 D-day */}
        {nextEvent && (
          <div className="mb-4 bg-white rounded-2xl p-4 cursor-pointer"
            style={{ boxShadow: '0 2px 12px rgba(245,158,11,0.12)', border: '1px solid #fde68a' }}
            onClick={() => navigate('/notice')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg text-white" style={{ background: '#d97706' }}>
                  {getDday(nextEvent.event_date)}
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-900">{nextEvent.event_name}</p>
                  <p className="text-xs text-gray-500">{nextEvent.event_date}</p>
                </div>
              </div>
              <span className="text-gray-400">›</span>
            </div>
          </div>
        )}

        {/* 메인 바로가기 */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button onClick={() => navigate('/ranking')}
            className="text-left rounded-2xl p-5 active:scale-[0.98] transition-transform"
            style={{ background: 'linear-gradient(135deg, #059669, #047857)', boxShadow: '0 4px 12px rgba(5,150,105,0.2)' }}>
            <span className="text-3xl block mb-3">🏆</span>
            <p className="text-white font-bold text-base">랭킹 / 참가</p>
            <p className="text-xs mt-1" style={{ color: '#a7f3d0' }}>랭킹조회 · 참가신청</p>
          </button>

          <a href="https://jeju-tournament.vercel.app/" target="_blank" rel="noopener noreferrer"
            className="text-left rounded-2xl p-5 active:scale-[0.98] transition-transform block"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}>
            <span className="text-3xl block mb-3">📊</span>
            <p className="text-white font-bold text-base">대회 운영</p>
            <p className="text-xs mt-1" style={{ color: '#bfdbfe' }}>실시간 스코어 · 대진표</p>
          </a>
        </div>

        {/* 퀵 메뉴 */}
        <div className="grid grid-cols-4 gap-2 mb-8">
          {[
            { icon: '📝', label: '개인전\n참가', path: '/entry' },
            { icon: '🏟️', label: '단체전\n참가', path: '/entry/team' },
            { icon: '📢', label: '공지\n사항', path: '/notice' },
            { icon: '🔍', label: '선수\n검색', path: '/search' },
          ].map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              className="bg-white rounded-xl p-3 text-center active:scale-[0.97] transition-transform"
              style={{ border: '1px solid #fde68a' }}>
              <span className="text-2xl block mb-1">{item.icon}</span>
              <span className="text-[10px] text-gray-500 whitespace-pre-line leading-tight">{item.label}</span>
            </button>
          ))}
        </div>

        {/* 업체 홍보 배너 */}
        {banners.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1" style={{ background: '#fde68a' }} />
              <span className="text-xs font-semibold tracking-widest" style={{ color: '#d97706' }}>SPONSORS</span>
              <div className="h-px flex-1" style={{ background: '#fde68a' }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {banners.map(b => (
                <a key={b.id} href={b.link_url || '#'} target="_blank" rel="noopener noreferrer"
                  className="bg-white rounded-xl overflow-hidden active:scale-[0.98] transition-transform block"
                  style={{ border: '1px solid #fde68a' }}>
                  {b.image_url ? (
                    <div className="aspect-[16/9] overflow-hidden">
                      <img src={b.image_url} alt={b.company_name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] flex items-center justify-center" style={{ background: '#fffbeb' }}>
                      <span className="text-3xl">🏢</span>
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-900 truncate">{b.company_name}</p>
                    {b.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{b.description}</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 푸터 */}
        <div className="text-center py-6 pb-20" style={{ borderTop: '1px solid #fde68a' }}>
          <p className="text-xs text-gray-300">© 2025 J.T.A랭킹 · 제주시 테니스 협회</p>
        </div>
      </div>
    </div>
  )
}
