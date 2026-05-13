import { useState } from 'react'
import { colors, categoryColors, CATEGORY_LABEL } from '../../lib/boardTheme'

function formatDate(s) {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`
}

function plainPreview(text) {
  return (text || '').replace(/\s+/g, ' ').trim()
}

export default function PostCard({ post, isAdmin, onClick, onEdit, onDelete, pinned }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const catKey = post.sub_category || post.category
  const cc = categoryColors[catKey] || categoryColors.notice
  const attCount = Array.isArray(post.post_attachments) ? post.post_attachments.length : 0

  const wrapStyle = pinned ? {
    background: colors.primaryTint,
    borderLeft: `3px solid ${colors.primary}`,
  } : {
    background: colors.surface,
  }

  return (
    <div
      onClick={onClick}
      style={{
        ...wrapStyle,
        borderRadius: 18,
        padding: 14,
        boxShadow: pinned ? 'none' : '0 2px 8px rgba(45,26,14,0.04)',
        cursor: 'pointer',
        position: 'relative',
        marginBottom: 10,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        {pinned && (
          <span style={{
            fontSize: 10, fontWeight: 800,
            background: colors.primary, color: '#fff',
            padding: '2px 7px', borderRadius: 8,
          }}>📌 고정</span>
        )}
        <span style={{
          fontSize: 10.5, fontWeight: 700,
          background: cc.bg, color: cc.text,
          padding: '2px 7px', borderRadius: 8,
        }}>
          {CATEGORY_LABEL[catKey] || catKey}
        </span>
        {attCount > 0 && (
          <span style={{ fontSize: 10, color: colors.textMid }}>📎 {attCount}</span>
        )}
      </div>

      <h3 style={{
        margin: 0, fontSize: 14.5, fontWeight: 800,
        color: colors.textDark, lineHeight: 1.35,
      }}>{post.title}</h3>

      <p style={{
        margin: '6px 0 0', fontSize: 12, color: colors.textMid,
        lineHeight: 1.5, display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{plainPreview(post.content)}</p>

      <div style={{
        marginTop: 8, display: 'flex', gap: 8,
        fontSize: 11, color: colors.textLight,
      }}>
        <span>{formatDate(post.created_at)}</span>
        <span>·</span>
        <span>조회 {post.view_count || 0}</span>
      </div>

      {isAdmin && (
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
            style={{
              background: 'transparent', border: 'none',
              color: colors.textLight, fontSize: 16,
              padding: '4px 8px', cursor: 'pointer',
            }}>⋯</button>
          {menuOpen && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', right: 0, top: '100%',
                background: '#fff', border: `1px solid ${colors.border}`,
                borderRadius: 10, padding: 4, minWidth: 110,
                boxShadow: '0 6px 16px rgba(0,0,0,0.1)', zIndex: 10,
              }}>
              <button
                onClick={() => { setMenuOpen(false); onEdit?.(post) }}
                style={{ display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 10px', border: 'none', background: 'transparent',
                  fontSize: 13, color: colors.textDark, cursor: 'pointer', borderRadius: 6 }}>
                ✏️ 수정
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete?.(post) }}
                style={{ display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 10px', border: 'none', background: 'transparent',
                  fontSize: 13, color: '#d14545', cursor: 'pointer', borderRadius: 6 }}>
                🗑 삭제
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
