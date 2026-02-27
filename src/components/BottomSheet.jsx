import { useEffect } from 'react'

export default function BottomSheet({ open, onClose, title, children }) {
  // body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/40 bottom-sheet-overlay"
        onClick={onClose}
      />

      {/* 시트 */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-r2 bottom-sheet-enter max-h-[85vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* 헤더 */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-line">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-soft2 text-sub"
            >
              ✕
            </button>
          </div>
        )}

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 hide-scrollbar">
          {children}
        </div>
      </div>
    </div>
  )
}
