// src/lib/marketStorage.js
import { supabase } from './supabase'

const BUCKET = 'market-images'
const MAX_SIZE_MB = 5

// 이미지 리사이즈 + JPEG 변환 (용량 절감)
function resizeImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * ratio)
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => resolve(file) // 리사이즈 실패 시 원본 그대로 사용
    img.src = URL.createObjectURL(file)
  })
}

// 단일 이미지 업로드 → public URL 반환
export async function uploadMarketImage(file, memberId) {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드 가능합니다.')
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`)
  }

  const resized = await resizeImage(file)
  const path = `${memberId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, resized, { cacheControl: '3600', upsert: false })

  if (error) throw new Error('업로드 실패: ' + error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// 이미지 삭제 (publicUrl → Storage 경로 추출)
export async function deleteMarketImage(publicUrl) {
  try {
    const path = publicUrl.split('/market-images/')[1]
    if (!path) return
    await supabase.storage.from(BUCKET).remove([decodeURIComponent(path)])
  } catch (e) {
    console.error('이미지 삭제 실패:', e)
  }
}
