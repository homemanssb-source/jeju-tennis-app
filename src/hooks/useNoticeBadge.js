import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'jta_notice_last_read_at'

// 마지막 읽은 시각 가져오기 (없으면 현재 시각으로 초기화해 초기 사용자 뱃지 폭주 방지)
function getLastReadAt() {
  try {
    let ts = localStorage.getItem(STORAGE_KEY)
    if (!ts) {
      ts = new Date().toISOString()
      localStorage.setItem(STORAGE_KEY, ts)
    }
    return ts
  } catch {
    return new Date().toISOString()
  }
}

export function markNoticesRead() {
  try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()) } catch {}
}

export function useNoticeBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let active = true
    const lastRead = getLastReadAt()
    supabase.from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'notice')
      .gt('created_at', lastRead)
      .then(({ count: c }) => { if (active) setCount(c || 0) })
    return () => { active = false }
  }, [])

  return count
}
