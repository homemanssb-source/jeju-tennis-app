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
import { usePageView } from './hooks/usePageView'

export const ToastContext = createContext()

export default function App() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')
  const isHome = location.pathname === '/'
  const [toast, setToast] = useState(null)

  // 모든 페이지 접속 자동 추적 (관리자 페이지 제외)
  usePageView()

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
        {!isAdmin && !isHome && <TabBar />}
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </ToastContext.Provider>
  )
}