import { useRef, useState } from 'react'
import { colors } from '../../lib/boardTheme'
import { validateFile, MAX_FILES, ALLOWED_EXT, formatSize } from '../../lib/supabaseStorage'

export default function AttachmentUploader({ files, onChange }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

  function handleFiles(picked) {
    setError('')
    const list = Array.from(picked || [])
    if (files.length + list.length > MAX_FILES) {
      setError(`최대 ${MAX_FILES}개까지만 첨부할 수 있습니다.`); return
    }
    const next = [...files]
    for (const f of list) {
      const err = validateFile(f)
      if (err) { setError(err); return }
      next.push(f)
    }
    onChange(next)
  }

  function removeAt(i) {
    const next = files.slice()
    next.splice(i, 1)
    onChange(next)
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        style={{
          border: `1.5px dashed ${dragOver ? colors.primary : colors.borderStrong}`,
          background: dragOver ? colors.primaryTint : colors.surface,
          borderRadius: 14, padding: '18px 14px',
          textAlign: 'center', cursor: 'pointer',
          transition: 'all 0.15s',
        }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.textDark }}>
          📎 파일을 드래그하거나 클릭하여 업로드
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: colors.textMid }}>
          최대 {MAX_FILES}개 · 파일당 10MB · {ALLOWED_EXT.join(', ')}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_EXT.map(e => '.' + e).join(',')}
          onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          style={{ display: 'none' }}
        />
      </div>

      {error && (
        <p style={{ margin: '6px 2px 0', fontSize: 11, color: '#d14545' }}>{error}</p>
      )}

      {files.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
          {files.map((f, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', background: colors.surface,
              border: `1px solid ${colors.border}`, borderRadius: 10,
              marginBottom: 6,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span style={{
                  fontSize: 12.5, color: colors.textDark,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>📄 {f.name}</span>
                <span style={{ fontSize: 10.5, color: colors.textLight }}>{formatSize(f.size)}</span>
              </div>
              <button
                onClick={() => removeAt(i)}
                style={{
                  background: 'transparent', border: 'none',
                  color: '#d14545', fontSize: 14, cursor: 'pointer',
                  padding: '4px 8px', flexShrink: 0,
                }}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
