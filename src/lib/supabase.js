import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase 환경변수가 설정되지 않았습니다')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── 전체 행 조회 ────────────────────────────────
// Supabase 는 한 번에 최대 1000행만 돌려준다. 회원처럼 1000건을 넘는 목록은
// 이 함수로 나눠 받아야 뒤쪽(이름순이면 ㅎ 성씨)이 잘리지 않는다.
// build: 매 페이지마다 새 쿼리를 만들어 돌려주는 함수. 정렬은 고유 컬럼까지 줘야 페이지 경계가 안정적이다.
export async function fetchAllRows(build, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1)
    if (error) return { data: rows.length ? rows : null, error }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return { data: rows, error: null }
}

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