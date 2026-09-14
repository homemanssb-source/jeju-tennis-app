// src/lib/ageGroups.js — 선수 연령별 부서 자동 편성
// 기준: 연 나이 = 기준연도 − 출생연도 (대회 개최 연도 기준, 생일 무관)
// 그룹 기준을 바꾸려면 AGE_GROUPS 만 수정하면 관리자/참가신청 모두 반영됩니다.

export const AGE_GROUPS = [
  { label: '10세 이하', max: 10 },
  { label: '12세 이하', max: 12 },
  { label: '14세 이하', max: 14 },
  { label: '16세 이하', max: 16 },
  { label: '18세 이하', max: 18 },
  { label: '일반부',   max: Infinity },
]

export function birthYearOf(birthdate) {
  if (!birthdate) return null
  const y = parseInt(String(birthdate).slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

// 연 나이 (기준연도 − 출생연도)
export function yearAge(birthdate, baseYear = new Date().getFullYear()) {
  const y = birthYearOf(birthdate)
  if (y === null) return null
  return baseYear - y
}

// 만 나이 (오늘 기준)
export function fullAge(birthdate) {
  if (!birthdate) return null
  const b = new Date(birthdate)
  if (isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

// 연령부서 라벨 (생년월일 없으면 null)
export function ageGroupOf(birthdate, baseYear = new Date().getFullYear()) {
  const age = yearAge(birthdate, baseYear)
  if (age === null) return null
  const g = AGE_GROUPS.find(g => age <= g.max)
  return g ? g.label : null
}
