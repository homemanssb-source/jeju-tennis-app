import React, { useState, createContext, useCallback } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import TabBar from './components/TabBar'
import Toast from './components/Toast'
import HomePage from './pages/HomePage'
import RankingPage from './pages/RankingPage'
import SearchPage from './pages/SearchPage'
import TournamentPage from './pages/TournamentPage'
import ApplyPage from './pages/ApplyPage'
import NoticePage from './pages/NoticePage'
import RegisterPage from './pages/RegisterPage'
import EventEntryPage from './pages/EventEntryPage'
import TeamEntryPage from './pages/TeamEntryPage'
import BoardPage from './pages/BoardPage'
import PinChangePage from './pages/PinChangePage'
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './pages/admin/AdminLayout'

export const ToastContext = createContext()

export default function App() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')
  const isHome = location.pathname === '/'
  const [toast, setToast] = useState(null)

  // ✅ useCallback으로 감싸서 Toast 무한 리렌더 방지
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      <div className="min-h-screen bg-white">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/tournament" element={<TournamentPage />} />
          <Route path="/entry" element={<EventEntryPage />} />
          <Route path="/entry/team" element={<TeamEntryPage />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/pin" element={<PinChangePage />} />
          <Route path="/apply" element={<ApplyPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/notice" element={<NoticePage />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/*" element={<AdminLayout />} />
        </Routes>
        {/* 어드민, 홈 페이지에서는 TabBar 숨김 */}
        {!isAdmin && !isHome && <TabBar />}
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </ToastContext.Provider>
  )
}