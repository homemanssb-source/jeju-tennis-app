// supabase/functions/admin-reset-password/index.ts
// 슈퍼관리자가 일반 관리자의 비밀번호를 새로 설정한다 (비밀번호 찾기 대용).
// 슈퍼관리자 계정 자체는 여기서 초기화할 수 없다 — Supabase 대시보드에서만.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 호출자는 슈퍼관리자여야 함
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: userData } = token ? await supabase.auth.getUser(token) : { data: { user: null } }
  const callerEmail = userData?.user?.email
  const { data: caller } = callerEmail
    ? await supabase.from('admin_users').select('id').eq('email', callerEmail).eq('is_super', true).maybeSingle()
    : { data: null }
  if (!caller) return json({ error: '슈퍼관리자만 초기화할 수 있습니다.' }, 401)

  try {
    const { email, password } = await req.json()
    if (!email || !password) return json({ error: 'email, password 필수' }, 400)
    if (String(password).length < 6) return json({ error: '비밀번호는 6자 이상이어야 합니다.' }, 400)

    // 대상은 슈퍼가 아닌 관리자만
    const { data: target } = await supabase.from('admin_users')
      .select('id, is_super').eq('email', email).maybeSingle()
    if (!target) return json({ error: '관리자 계정이 아닙니다.' }, 404)
    if (target.is_super) return json({ error: '슈퍼관리자 비밀번호는 앱에서 초기화할 수 없습니다.' }, 403)

    // 이메일로 로그인 계정 찾기 (listUsers 페이지 순회)
    const want = String(email).trim().toLowerCase()
    let authUserId: string | null = null
    for (let page = 1; !authUserId; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw error
      authUserId = data.users.find(u => u.email?.toLowerCase() === want)?.id ?? null
      if (data.users.length < 1000) break
    }
    if (!authUserId) return json({ error: '로그인 계정이 없습니다. Supabase 대시보드에서 먼저 만들어주세요.' }, 404)

    const { error } = await supabase.auth.admin.updateUserById(authUserId, { password })
    if (error) throw error

    return json({ ok: true })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
})
