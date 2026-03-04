import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { getSession, adminLogout } from '../../lib/supabase'
import MemberAdmin from './MemberAdmin'
import TourAdmin from './TourAdmin'
import PointAdjAdmin from './PointAdjAdmin'
import PointRulesAdmin from './PointRulesAdmin'
import PromotionAdmin from './PromotionAdmin'
import PromotionRulesAdmin from './PromotionRulesAdmin'
import NoticeAdmin from './NoticeAdmin'
import EventAdmin from './EventAdmin'
import PaymentAdmin from './PaymentAdmin'
import EntryAdmin from './EntryAdmin'
import GradeAdmin from './GradeAdmin'
import UploadAdmin from './UploadAdmin'
import AdminBoardPage from './AdminBoardPage'
import AdminTeamEntryPage from './AdminTeamEntryPage'
import SponsorAdmin from './SponsorAdmin'

const adminTabs = [
  { path: '/admin/members', label: '👤 회원' },
  { path: '/admin/upload', label: '📁 엑셀업로드' },
  { path: '/admin/events', label: '🎫 대회관리' },
  { path: '/admin/entries', label: '📋 참가관리' },
  { path: '/admin/team-entries', label: '🏟️ 단체전' },
  { path: '/admin/payments', label: '💳 결제관리' },
  { path: '/admin/tournaments', label: '🏆 결과입력' },
  { path: '/admin/adjustments', label: '±조정' },
  { path: '/admin/rules', label: '📐 포인트룰' },
  { path: '/admin/grades', label: '🎖 등급관리' },
  { path: '/admin/promotion-rules', label: '📊 등급룰' },
  { path: '/admin/promotions', label: '🔄 등급배치' },
  { path: '/admin/notices', label: '📢 공지' },
  { path: '/admin/board', label: '💬 게시판' },
  { path: '/admin/sponsors', label: '🏢 홍보배너' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => { checkSession() }, [])

  async function checkSession() {
    const s = await getSession()
    if (!s) navigate('/admin')
    else setSession(s)
    setChecking(false)
  }

  async function handleLogout() { await adminLogout(); navigate('/admin') }

  if (checking) return <div className="min-h-screen flex items-center justify-center"><p className="text-sm text-sub">세션 확인 중...</p></div>

  return (
    <div className="min-h-screen bg-soft">
      <div className="sticky top-0 bg-white z-40 border-b border-line">
        <div className="flex items-center justify-between px-4 py-2 max-w-5xl mx-auto">
          <h1 className="text-sm font-bold text-gray-900">🎾 관리자</h1>
          <div className="flex gap-2">
            <button onClick={() => navigate('/')} className="text-xs text-sub hover:text-gray-700 px-2 py-1">공개 페이지</button>
            <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-700 px-2 py-1">로그아웃</button>
          </div>
        </div>
        <div className="overflow-x-auto hide-scrollbar">
          <div className="flex min-w-max px-4 gap-1 pb-2 max-w-5xl mx-auto">
            {adminTabs.map(tab => {
              const active = location.pathname === tab.path
              return (
                <button key={tab.path} onClick={() => navigate(tab.path)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors
                    ${active ? 'bg-accent text-white' : 'bg-white text-sub hover:bg-soft2 border border-line'}`}>
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto p-4">
        <Routes>
          <Route path="members" element={<MemberAdmin />} />
          <Route path="upload" element={<UploadAdmin />} />
          <Route path="events" element={<EventAdmin />} />
          <Route path="entries" element={<EntryAdmin />} />
          <Route path="team-entries" element={<AdminTeamEntryPage />} />
          <Route path="payments" element={<PaymentAdmin />} />
          <Route path="tournaments" element={<TourAdmin />} />
          <Route path="adjustments" element={<PointAdjAdmin />} />
          <Route path="rules" element={<PointRulesAdmin />} />
          <Route path="grades" element={<GradeAdmin />} />
          <Route path="promotion-rules" element={<PromotionRulesAdmin />} />
          <Route path="promotions" element={<PromotionAdmin />} />
          <Route path="notices" element={<NoticeAdmin />} />
          <Route path="board" element={<AdminBoardPage />} />
          <Route path="sponsors" element={<SponsorAdmin />} />
        </Routes>
      </div>
    </div>
  )
}
