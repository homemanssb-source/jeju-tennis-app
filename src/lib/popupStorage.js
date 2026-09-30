// src/lib/popupStorage.js
import { supabase } from './supabase'
import { resizeImage } from './marketStorage'

const BUCKET = 'popup-images'
const MAX_SIZE_MB = 5

// 팝업 이미지 업로드 → public URL 반환 (관리자 전용)
export async function uploadPopupImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드 가능합니다.')
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`)
  }

  // GIF 는 리사이즈하면 애니메이션이 사라지므로 원본 유지
  const upload = file.type === 'image/gif' ? file : await resizeImage(file, 1080, 1600, 0.88)
  const ext = upload.type === 'image/gif' ? 'gif' : 'jpg'
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, upload, { cacheControl: '86400', upsert: false })

  if (error) throw new Error('업로드 실패: ' + error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// 이미지 삭제 (publicUrl → Storage 경로 추출). 외부 URL 이면 무시
export async function deletePopupImage(publicUrl) {
  try {
    const path = publicUrl?.split(`/${BUCKET}/`)[1]
    if (!path) return
    await supabase.storage.from(BUCKET).remove([decodeURIComponent(path)])
  } catch (e) {
    console.error('이미지 삭제 실패:', e)
  }
}

// 스폰서 배너 이미지 업로드 → public URL 반환 (관리자 전용, 같은 버킷의 sponsors/ 폴더)
// 로고는 투명 배경 PNG 가 많아서 JPG 로 바꾸면 배경이 검게 되므로 PNG·WebP·GIF 는 원본 유지
export async function uploadSponsorImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드 가능합니다.')
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`)
  }

  const keepOriginal = ['image/png', 'image/webp', 'image/gif'].includes(file.type)
  const upload = keepOriginal ? file : await resizeImage(file, 800, 800, 0.9)
  const ext = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[upload.type] || 'jpg'
  const path = `sponsors/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, upload, { cacheControl: '86400', upsert: false })

  if (error) throw new Error('업로드 실패: ' + error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
