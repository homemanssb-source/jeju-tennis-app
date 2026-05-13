// src/hooks/usePageView.js
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function getOrCreateSessionId() {
  let sid = sessionStorage.getItem('jta_sid')
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('jta_sid', sid)
  }
  return sid
}

function getDevice() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'pc'
}

const PAGE_NAMES = {
  '/':            '홈',
  '/ranking':     '랭킹',
  '/search':      '선수검색',
  '/tournament':  '대회결과',
  '/entry':       '대회참가',
  '/entry/team':  '팀참가',
  '/board':       '건의/문의',
  '/pin':         'PIN변경',
  '/apply':       '가입신청',
  '/register':    '선수등록',
  '/notice':      '공지사항',
  '/market':      '용품거래',
}

export function usePageView() {
  const location = useLocation()

  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return
    const pageName = PAGE_NAMES[location.pathname] || location.pathname
    supabase.from('page_views').insert({
      page: pageName,
      page_path: location.pathname,
      device: getDevice(),
      session_id: getOrCreateSessionId(),
    }).then(() => {})
  }, [location.pathname])
}
