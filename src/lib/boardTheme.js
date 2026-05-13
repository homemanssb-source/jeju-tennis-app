// JTA 광장 전역 컬러 토큰
export const colors = {
  bg:           '#faf6f1',
  primary:      '#c0612b',
  primaryBg:    '#fceadd',
  primaryTint:  '#fef3ec',
  surface:      '#fff',
  textDark:     '#2d1a0e',
  textMid:      '#7a6a62',
  textLight:    '#b8a394',
  textHint:     '#c8a898',
  border:       '#f0e8e0',
  borderStrong: '#ece1d4',
  headerBg:     '#fff8f3',
}

// 메인 카테고리 / 서브카테고리 컬러
export const categoryColors = {
  association: { bg: '#eaf0fa', text: '#2c5fb8' },
  tournament:  { bg: '#fceadd', text: '#c0612b' },
  recruit:     { bg: '#ecf5ee', text: '#2d8a48' },
  result:      { bg: '#f3e7f5', text: '#8a3ba0' },
  club:        { bg: '#eaf0fa', text: '#2c5fb8' },
  shop:        { bg: '#ecf5ee', text: '#2d8a48' },
  lesson:      { bg: '#fceadd', text: '#c0612b' },
  notice:      { bg: '#fceadd', text: '#c0612b' },
}

export const MAIN_TABS = [
  { key: 'notice', label: '공지사항',   icon: '📢' },
  { key: 'club',   label: '클럽',       icon: '🏸' },
  { key: 'shop',   label: '테니스용품', icon: '🏪' },
  { key: 'lesson', label: '레슨안내',   icon: '🎾' },
]

export const SUB_CATS = [
  { key: 'association', label: '협회', icon: '📣' },
  { key: 'tournament',  label: '대회', icon: '🏆' },
  { key: 'recruit',     label: '모집', icon: '📋' },
  { key: 'result',      label: '결과', icon: '📊' },
]

export const CATEGORY_LABEL = {
  notice: '📢 공지사항', club: '🏸 클럽',
  shop:   '🏪 테니스용품', lesson: '🎾 레슨안내',
  association: '📣 협회', tournament: '🏆 대회',
  recruit: '📋 모집', result: '📊 결과',
}
