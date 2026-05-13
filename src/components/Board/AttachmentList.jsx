import { colors } from '../../lib/boardTheme'
import { publicUrl, formatSize } from '../../lib/supabaseStorage'

export default function AttachmentList({ attachments }) {
  if (!attachments || attachments.length === 0) return null

  function handleDownload(att) {
    const url = publicUrl(att.file_path)
    const a = document.createElement('a')
    a.href = url
    a.download = att.file_name
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a); a.click(); a.remove()
  }

  return (
    <div style={{ marginTop: 20 }}>
      <p style={{
        margin: '0 0 8px', fontSize: 12.5, fontWeight: 700,
        color: colors.textDark,
      }}>📎 첨부파일 ({attachments.length})</p>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {attachments.map(att => (
          <li key={att.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', background: colors.surface,
            border: `1px solid ${colors.border}`, borderRadius: 10,
            marginBottom: 6,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span style={{
                fontSize: 13, color: colors.textDark,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>📄 {att.file_name}</span>
              <span style={{ fontSize: 11, color: colors.textLight }}>{formatSize(att.file_size)}</span>
            </div>
            <button
              onClick={() => handleDownload(att)}
              style={{
                background: colors.primary, color: '#fff', border: 'none',
                padding: '7px 12px', borderRadius: 10,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              }}>⬇ 다운로드</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
