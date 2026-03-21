import { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { getSession, adminLogout, getAdminUser } from '../../lib/supabase'

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
import AdminManagerPage from './AdminManagerPage'
import AdminLogsPage from './AdminLogsPage'
import AccessLogAdmin from './AccessLogAdmin'
import PushAdmin from './PushAdmin'

// ─── 관리자 정보 Context ─────────────────────────
export const AdminContext = createContext(null)
export function useAdmin() { return useContext(AdminContext) }

// ─── 탭 그룹 구조 ────────────────────────────────
const TAB_GROUPS = [
  {
    key: 'members',
    label: '👥 회원',
    subs: [
      { path: '/admin/members', label: '회원 목록' },
      { path: '/admin/upload', label: '데이터 업로드' },
    ],
  },
  {
    key: 'events',
    label: '🏆 대회',
    subs: [
      { path: '/admin/events', label: '대회 관리' },
      { path: '/admin/entries', label: '참가 관리' },
      { path: '/admin/team-entries', label: '팀 단체전' },
      { path: '/admin/tournaments', label: '결과 입력' },
    ],
  },
  {
    key: 'payments',
    label: '💰 결제',
    subs: [
      { path: '/admin/payments', label: '결제 관리' },
    ],
  },
  {
    key: 'rankings',
    label: '📊 랭킹',
    subs: [
      { path: '/admin/rules', label: '포인트 룰' },
      { path: '/admin/adjustments', label: '포인트 조정' },
      { path: '/admin/grades', label: '등급 관리' },
      { path: '/admin/promotion-rules', label: '등급 룰' },
      { path: '/admin/promotions', label: '등급 배치' },
    ],
  },
  {
    key: 'notices',
    label: '📢 공지',
    subs: [
      { path: '/admin/notices', label: '공지 관리' },
      { path: '/admin/board', label: '게시판' },
      { path: '/admin/sponsors', label: '스폰서 배너' },
      { path: '/admin/push', label: '🔔 푸시 알림' },
    ],
  },
  {
    key: 'stats',
    label: '📈 통계',
    superOnly: true,
    subs: [
      { path: '/admin/access-log', label: '접속통계' },
    ],
  },
  {
    key: 'settings',
    label: '⚙️ 설정',
    superOnly: true,
    subs: [
      { path: '/admin/managers', label: '관리자 계정' },
      { path: '/admin/logs', label: '수정 로그' },
    ],
  },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [adminUser, setAdminUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [activeGroup, setActiveGroup] = useState(null)

  useEffect(() => { checkSession() }, [])

  // 현재 경로에 맞는 그룹 자동 선택
  useEffect(() => {
    const group = TAB_GROUPS.find(g =>
      g.subs.some(s => location.pathname.startsWith(s.path))
    )
    if (group) setActiveGroup(group.key)
  }, [location.pathname])

  async function checkSession() {
    const session = await getSession()
    if (!session) { navigate('/admin'); return }

    const admin = await getAdminUser(session.user.email)
    if (!admin) {
      await adminLogout()
      navigate('/admin')
      return
    }
    setAdminUser(admin)
    setChecking(false)
  }

  async function handleLogout() {
    await adminLogout()
    navigate('/admin')
  }

  function canAccess(groupKey) {
    if (!adminUser) return false
    if (adminUser.is_super) return true
    if (groupKey === 'settings' || groupKey === 'stats') return false
    return adminUser.permissions?.[groupKey] === true
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-sub">세션 확인 중...</p>
      </div>
    )
  }

  const currentGroup = TAB_GROUPS.find(g => g.key === activeGroup)

  return (
    <AdminContext.Provider value={adminUser}>
      <div className="min-h-screen bg-soft">

        {/* ── 상단 헤더 ── */}
        <div className="sticky top-0 bg-white z-40 border-b border-line shadow-sm">
          <div className="flex items-center justify-between px-4 py-2 max-w-5xl mx-auto">
            <h1 className="text-sm font-bold text-gray-900">🎾 관리자</h1>
            <div className="flex items-center gap-3">
              <span className="text-xs text-sub">
                {adminUser.name}
                {adminUser.is_super && <span className="ml-1 text-accent font-medium">슈퍼</span>}
              </span>
              <button onClick={() => navigate('/')} className="text-xs text-sub hover:text-gray-700 px-2 py-1">공개 페이지</button>
              <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-700 px-2 py-1">로그아웃</button>
            </div>
          </div>

          {/* ── 메인 탭 ── */}
          <div className="flex px-4 gap-1 max-w-5xl mx-auto overflow-x-auto hide-scrollbar pb-1">
            {TAB_GROUPS.map(group => {
              const accessible = canAccess(group.key)
              const isActive = activeGroup === group.key
              return (
                <button
                  key={group.key}
                  onClick={() => {
                    if (!accessible) return
                    setActiveGroup(group.key)
                    navigate(group.subs[0].path)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1
                    ${isActive ? 'bg-accent text-white' : accessible ? 'bg-white text-gray-700 hover:bg-soft2 border border-line' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'}`}
                >
                  {group.label}
                  {!accessible && <span className="text-[10px]">🔒</span>}
                </button>
              )
            })}
          </div>

          {/* ── 서브 탭 ── */}
          {currentGroup && canAccess(currentGroup.key) && currentGroup.subs.length > 1 && (
            <div className="flex px-4 gap-1 max-w-5xl mx-auto overflow-x-auto hide-scrollbar pb-2 pt-1 border-t border-line/50">
              {currentGroup.subs.map(sub => {
                const isActive = location.pathname === sub.path
                return (
                  <button
                    key={sub.path}
                    onClick={() => navigate(sub.path)}
                    className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap transition-colors
                      ${isActive ? 'bg-accentSoft text-accent font-semibold' : 'text-sub hover:text-gray-700'}`}
                  >
                    {sub.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── 페이지 콘텐츠 ── */}
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
            <Route path="managers" element={<AdminManagerPage />} />
            <Route path="logs" element={<AdminLogsPage />} />
            <Route path="access-log" element={<AccessLogAdmin />} />
            <Route path="push" element={<PushAdmin />} />
          </Routes>
        </div>
      </div>
    </AdminContext.Provider>
  )
}

========================================
FILE: C:\Users\homem\OneDrive\바탕 화면\jeju-tennis-app\src\pages\admin\AdminLogin.jsx
