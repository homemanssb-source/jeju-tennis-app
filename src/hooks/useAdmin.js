import { useEffect, useState } from 'react'
import { getSession, getAdminUser } from '../lib/supabase'

// 기존 admin_users 테이블 기반으로 현재 사용자가 관리자인지 판별
export function useAdmin() {
  const [isAdmin, setIsAdmin]     = useState(false)
  const [adminUser, setAdminUser] = useState(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    let active = true
    async function check() {
      try {
        const session = await getSession()
        if (!session) { if (active) { setIsAdmin(false); setAdminUser(null) } ; return }
        const admin = await getAdminUser(session.user.email)
        if (active) { setIsAdmin(!!admin); setAdminUser(admin || null) }
      } catch {
        if (active) { setIsAdmin(false); setAdminUser(null) }
      } finally {
        if (active) setLoading(false)
      }
    }
    check()
    return () => { active = false }
  }, [])

  return { isAdmin, adminUser, loading }
}
