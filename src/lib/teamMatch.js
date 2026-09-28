// 팀전(클럽대항전) 경기방식 — 대회 기본값 + 부서별 예외
// events.team_match_type 은 대회 기본값, event_divisions.team_match_type 이 있으면 부서 값이 우선.

export const TEAM_MATCH_TYPES = [
  { value: '3_doubles', label: '3복식', full: '3복식 (2판 선승)' },
  { value: '5_doubles', label: '5복식', full: '5복식 (3판 선승)' },
]

export function getMatchTypeLabel(type, { full = false } = {}) {
  const t = TEAM_MATCH_TYPES.find(o => o.value === type)
  if (!t) return '-'
  return full ? t.full : t.label
}

// 부서에 값이 있으면 부서 값, 없으면 대회 기본값
export function resolveMatchType(event, division) {
  return division?.team_match_type || event?.team_match_type || null
}

export function resolveMemberLimit(event, division) {
  return division?.member_limit || event?.team_member_limit || null
}

// 팀전 신청 화면에 노출할 부서.
// 팀전 부서로 체크한 부서가 하나라도 있으면 그 부서만, 없으면 기존 동작(전체 노출) 유지.
export function filterTeamDivisions(event, divisions) {
  const list = divisions || []
  const flagged = list.filter(d => d.is_team_division)
  return flagged.length > 0 ? flagged : list
}

// 부서별 경기방식이 갈리는지 — 요약 표시를 대회 단일값으로 쓸 수 있는지 판단
export function hasMixedMatchType(event, divisions) {
  const set = new Set((divisions || []).map(d => resolveMatchType(event, d)).filter(Boolean))
  return set.size > 1
}
