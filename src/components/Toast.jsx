import { useEffect, useState } from 'react'

export default function Toast({ toast, onClose }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (!toast) return
    setExiting(false)

    const exitTimer = setTimeout(() => setExiting(true), 1200)
    const closeTimer = setTimeout(() => {
      onClose()
      setExiting(false)
    }, 1400)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(closeTimer)
    }
  }, [toast, onClose])

  if (!toast) return null

  const bgColor = toast.type === 'error'
    ? 'bg-red-600'
    : toast.type === 'warning'
    ? 'bg-amber-500'
    : 'bg-gray-800'

  return (
    <div className="fixed bottom-[80px] left-0 right-0 flex justify-center z-[100] pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className={`${bgColor} text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-lg
        ${exiting ? 'toast-exit' : 'toast-enter'}`}>
        {toast.message}
      </div>
    </div>
  )
}
