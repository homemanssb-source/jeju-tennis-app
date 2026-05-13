import { colors, SUB_CATS } from '../../lib/boardTheme'

export default function SubCategoryChips({ value, onChange, counts }) {
  const items = [
    { key: '', label: '전체', icon: '' },
    ...SUB_CATS,
  ]
  return (
    <div style={{
      display: 'flex', gap: 6, overflowX: 'auto',
      padding: '10px 16px',
    }}>
      {items.map(it => {
        const active = value === it.key
        const count = it.key === '' ? counts.all : counts[it.key]
        return (
          <button
            key={it.key || 'all'}
            onClick={() => onChange(it.key)}
            style={{
              flexShrink: 0,
              background: active ? colors.primaryBg : 'transparent',
              color:      active ? colors.primary : colors.textMid,
              border: 'none',
              padding: '6px 10px', borderRadius: 12,
              fontSize: 12, fontWeight: active ? 700 : 500,
              cursor: 'pointer', whiteSpace: 'nowrap',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
            {it.icon && <span>{it.icon}</span>}
            <span>{it.label}</span>
            {count != null && (
              <span style={{
                fontSize: 10, color: active ? colors.primary : colors.textLight,
                background: active ? 'rgba(192,97,43,0.12)' : 'transparent',
                padding: '1px 6px', borderRadius: 10, fontWeight: 600,
              }}>{count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
