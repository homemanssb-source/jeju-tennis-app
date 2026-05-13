import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function usePosts({ category, subCategory } = {}) {
  const [posts, setPosts]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    let q = supabase
      .from('posts')
      .select('id, category, sub_category, title, content, pinned, view_count, created_at, post_attachments(id)')
      .order('pinned',     { ascending: false })
      .order('created_at', { ascending: false })
    if (category) q = q.eq('category', category)
    if (subCategory) q = q.eq('sub_category', subCategory)
    const { data, error: err } = await q
    if (err) setError(err)
    setPosts(data || [])
    setLoading(false)
  }, [category, subCategory])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  return { posts, loading, error, refetch: fetchPosts }
}

export async function fetchPostById(id) {
  const { data, error } = await supabase
    .from('posts')
    .select('*, post_attachments(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function incrementViews(id) {
  try { await supabase.rpc('rpc_increment_post_views', { p_post_id: id }) } catch {}
}

// 공지사항 서브카테고리별 카운트
export function useNoticeCounts() {
  const [counts, setCounts] = useState({ all: 0, association: 0, tournament: 0, recruit: 0, result: 0 })
  useEffect(() => {
    let active = true
    async function load() {
      const { data } = await supabase
        .from('posts')
        .select('sub_category')
        .eq('category', 'notice')
      if (!active) return
      const c = { all: data?.length || 0, association: 0, tournament: 0, recruit: 0, result: 0 }
      for (const r of (data || [])) if (r.sub_category && c[r.sub_category] !== undefined) c[r.sub_category]++
      setCounts(c)
    }
    load()
    return () => { active = false }
  }, [])
  return counts
}
