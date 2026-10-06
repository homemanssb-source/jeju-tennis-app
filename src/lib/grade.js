// 등급 표기 통일
// DB 저장값은 "5", "4.5", "지도자3" 처럼 '점' 없이 저장한다 (DB 트리거 normalize_grade 와 같은 규칙).
// 예전에 "4.5점" 이 섞여 Number("4.5점") = NaN 이 되어 승급 계산·등급 검색이 깨졌던 문제 때문.
// 화면에는 formatGrade 로 항상 "5점" 형태로 보여준다.

export function normalizeGrade(v) {
  if (v === null || v === undefined) return ''
  let s = String(v).replace(/\s+/g, '').replace(/점$/, '')
  s = s.replace(/(\d+)\.0$/, '$1') // "5.0" → "5"
  return s
}

export function formatGrade(v) {
  const s = normalizeGrade(v)
  return s ? `${s}점` : ''
}

// 승급 계산용 숫자 ("지도자3" → 3)
export function gradeNumber(v) {
  const n = parseFloat(normalizeGrade(v).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}
