import { supabase } from './supabase'

export const BUCKET = 'notice-attachments'
export const MAX_FILES = 5
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'hwp', 'xlsx', 'docx']

export function sanitizeFileName(name) {
  // 한글/영숫자/일부 특수문자만 남기고 공백 → _
  return (name || '').replace(/[^\p{L}\p{N}._-]/gu, '_')
}

export function fileExt(name) {
  const i = (name || '').lastIndexOf('.')
  return i < 0 ? '' : name.slice(i + 1).toLowerCase()
}

export function validateFile(file) {
  if (file.size > MAX_FILE_SIZE) {
    return `파일이 너무 큽니다 (10MB 이하): ${file.name}`
  }
  const ext = fileExt(file.name)
  if (!ALLOWED_EXT.includes(ext)) {
    return `허용되지 않은 형식입니다 (.${ext}): ${file.name}`
  }
  return null
}

export async function uploadAttachment(postId, file) {
  const safeName = sanitizeFileName(file.name)
  const path = `${postId}/${Date.now()}_${safeName}`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (upErr) throw upErr
  return {
    file_name: file.name,
    file_path: path,
    file_size: file.size,
    mime_type: file.type || null,
  }
}

export function publicUrl(path) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function removeAttachment(path) {
  await supabase.storage.from(BUCKET).remove([path])
}

export function formatSize(bytes) {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
