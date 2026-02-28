import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const mainTabs = [
  { path: '/', label: '랭킹', icon: '🏆' },
  { path: '/search', label: '검색', icon: '🔎' },
  { path: '/tournament', label: '대회', icon: '📅' },
  { path: '/notice', label: '공지', icon: '📌' },
]

const moreTabs = [
  { path: '/entry', label: '참가신청', icon: '✍️' },
  { path: '/apply', label: '신청확인', icon: '📝' },
  { path: '/register', label: '동호인등록', icon: '👤' },
]

export default function TabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      {showMore && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-[60px] right-2 bg-white border border-line rounded-xl shadow-lg p-2 min-w-[140px]"
            onClick={e => e.stopPropagation()}>
            {moreTabs.map(tab => (
              <button key={tab.path}
                onClick={() => { navigate(tab.path); setShowMore(false) }}
                className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-soft flex items-center gap-2">
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-line z-10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex justify-around items-center h-[56px] max-w-lg mx-auto">
          {mainTabs.map(tab => {
            const active = location.pathname === tab.path
            return (
              <button key={tab.path} onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 transition-colors
                  ${active ? 'text-accent' : 'text-sub'}`}>
                <span className="text-[18px] leading-none">{tab.icon}</span>
                <span className={`text-[10px] leading-none font-medium
                  ${active ? 'text-accent' : 'text-sub'}`}>{tab.label}</span>
              </button>
            )
          })}
          <button onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 transition-colors
              ${showMore ? 'text-accent' : 'text-sub'}`}>
            <span className="text-[18px] leading-none">≡</span>
            <span className={`text-[10px] leading-none font-medium
              ${showMore ? 'text-accent' : 'text-sub'}`}>더보기</span>
          </button>
        </div>
      </nav>
    </>
  )
}
