// supabase/functions/push-subscribe/index.ts
// 사용자 구독 정보 저장 / 삭제

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const body = await req.json()

    // ── 구독 저장 (POST) ──────────────────────────
    if (req.method === 'POST') {
      const { endpoint, p256dh, auth } = body
      if (!endpoint || !p256dh || !auth) {
        return new Response(JSON.stringify({ error: '필수 파라미터 누락' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({ endpoint, p256dh, auth, created_at: new Date().toISOString() }, { onConflict: 'endpoint' })

      if (error) throw error
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── 구독 삭제 (DELETE) ────────────────────────
    if (req.method === 'DELETE') {
      const { endpoint } = body
      if (!endpoint) {
        return new Response(JSON.stringify({ error: 'endpoint 필요' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
