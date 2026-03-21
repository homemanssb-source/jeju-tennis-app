import { useEffect } from 'react'
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
  const ua = navigator.userAgent
  if (/Mobi|Android|iPhone|iPad/i.test(ua)) return 'mobile'
  return 'pc'
}

export function usePageView(pageName) {
  useEffect(() => {
    supabase.from('page_views').insert({
      page: pageName,
      device: getDevice(),
      session_id: getOrCreateSessionId()
    }).then(() => {})
  }, [pageName])
}
