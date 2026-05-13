import { colors, MAIN_TABS } from '../../lib/boardTheme'

export default function BoardTabBar({ value, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 8, overflowX: 'auto',
      padding: '10px 16px', background: colors.surface,
      borderBottom: `1px solid ${colors.border}`,
    }}>
      {MAIN_TABS.map(t => {
        const active = value === t.key
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              flexShrink: 0,
              background: active ? colors.primary : colors.surface,
              color:      active ? '#fff' : colors.textMid,
              border:     active ? 'none' : `1px solid ${colors.borderStrong}`,
              padding: '7px 13px', borderRadius: 14,
              fontSize: 12.5, fontWeight: active ? 800 : 500,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
          </button>
        )
      })}
    </div>
  )
}
