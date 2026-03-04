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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* 히어로 섹션 */}
      <div className="relative overflow-hidden">
        {/* 배경 패턴 */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-green-500 blur-[100px]" />
          <div className="absolute bottom-10 right-10 w-48 h-48 rounded-full bg-yellow-500 blur-[80px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-emerald-400 blur-[120px]" />
        </div>

        <div className="relative max-w-lg mx-auto px-5 pt-12 pb-6">
          {/* 로고 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-4xl">🎾</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white mb-1">
              J.T.A<span className="text-emerald-400">랭킹</span>
            </h1>
            <p className="text-sm text-gray-400 tracking-widest uppercase">
              Jeju Tennis Association
            </p>
          </div>

          {/* 다음 대회 공지 */}
          {nextEvent && (
            <div className="mb-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4"
              onClick={() => navigate('/notice')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                    {getDday(nextEvent.event_date)}
                  </span>
                  <div>
                    <p className="text-white text-sm font-bold">{nextEvent.event_name}</p>
                    <p className="text-gray-400 text-xs">{nextEvent.event_date}</p>
                  </div>
                </div>
                <span className="text-gray-400">›</span>
              </div>
            </div>
          )}

          {/* 메인 바로가기 버튼 2개 */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* 참가신청 (앱A 내부) */}
            <button
              onClick={() => navigate('/ranking')}
              className="group relative bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-left overflow-hidden active:scale-[0.98] transition-transform"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <span className="text-3xl mb-3 block">🏆</span>
              <p className="text-white font-bold text-base">랭킹 / 참가</p>
              <p className="text-green-100 text-xs mt-1">랭킹조회 · 참가신청</p>
            </button>

            {/* 대회운영 (앱B 외부) */}
            <a
              href="https://jeju-tournament.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-left overflow-hidden active:scale-[0.98] transition-transform"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <span className="text-3xl mb-3 block">📊</span>
              <p className="text-white font-bold text-base">대회 운영</p>
              <p className="text-blue-100 text-xs mt-1">실시간 스코어 · 대진표</p>
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
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 text-center transition-colors active:scale-[0.97]"
              >
                <span className="text-2xl block mb-1">{item.icon}</span>
                <span className="text-[10px] text-gray-300 whitespace-pre-line leading-tight">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 업체 홍보 배너 섹션 */}
      {banners.length > 0 && (
        <div className="max-w-lg mx-auto px-5 pb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-gray-500 uppercase tracking-widest">Partners & Sponsors</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {banners.map(b => (
              <a
                key={b.id}
                href={b.link_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/30 transition-all active:scale-[0.98]"
              >
                {b.image_url ? (
                  <div className="aspect-[16/9] overflow-hidden bg-gray-800">
                    <img
                      src={b.image_url}
                      alt={b.company_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                    <span className="text-2xl">🏢</span>
                  </div>
                )}
                <div className="p-3">
                  <p className="text-white text-sm font-medium truncate">{b.company_name}</p>
                  {b.description && (
                    <p className="text-gray-400 text-xs mt-0.5 truncate">{b.description}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 푸터 */}
      <div className="max-w-lg mx-auto px-5 pb-24">
        <div className="text-center py-6 border-t border-white/10">
          <p className="text-gray-600 text-xs">© 2025 J.T.A랭킹 · 제주시 테니스 협회</p>
        </div>
      </div>
    </div>
  )
}
