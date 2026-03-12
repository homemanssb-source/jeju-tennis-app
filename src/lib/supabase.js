import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase 환경변수가 설정되지 않았습니다')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── 세션 ───────────────────────────────────────
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function adminLogout() {
  await supabase.auth.signOut()
}

// ─── 관리자 정보 조회 ────────────────────────────
export async function getAdminUser(email) {
  const { data } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email)
    .single()
  return data
}

// ─── 수정 로그 기록 ──────────────────────────────
export async function writeLog({ adminEmail, adminName, action, targetTable, targetId, targetLabel, beforeData, afterData }) {
  await supabase.from('admin_logs').insert([{
    admin_email: adminEmail,
    admin_name: adminName,
    action,
    target_table: targetTable,
    target_id: String(targetId || ''),
    target_label: targetLabel || '',
    before_data: beforeData || null,
    after_data: afterData || null,
  }])
}