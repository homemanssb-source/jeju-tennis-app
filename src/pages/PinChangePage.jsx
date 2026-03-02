import { useState, useContext } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { ToastContext } from '../App'

export default function PinChangePage() {
  const showToast = useContext(ToastContext)
  const [name, setName] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleChangePin() {
    if (!name.trim()) { showToast?.('이름을 입력해주세요.', 'error'); return }
    if (currentPin.length !== 6) { showToast?.('현재 PIN 6자리를 입력해주세요.', 'error'); return }
    if (newPin.length !== 6) { showToast?.('새 PIN 6자리를 입력해주세요.', 'error'); return }
    if (newPin !== confirmPin) { showToast?.('새 PIN이 일치하지 않습니다.', 'error'); return }
    if (currentPin === newPin) { showToast?.('현재 PIN과 동일합니다.', 'error'); return }

    setSubmitting(true)
    const { data, error } = await supabase.rpc('rpc_change_pin', {
      p_name: name.trim(), p_current_pin: currentPin, p_new_pin: newPin,
    })
    if (error) { showToast?.('변경 실패: ' + error.message, 'error') }
    else if (data && !data.ok) { showToast?.('⚠️ ' + data.message, 'error') }
    else if (data && data.ok) {
      showToast?.('✅ PIN이 변경되었습니다.')
      setCurrentPin(''); setNewPin(''); setConfirmPin('')
    }
    setSubmitting(false)
  }

  return (
    <div className="pb-20">
      <PageHeader title="🔑 PIN 변경" subtitle="참가신청 등에 사용되는 PIN을 변경합니다" />
      <div className="max-w-lg mx-auto px-5 py-4 space-y-4">

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
          <p className="text-xs text-blue-700">📌 PIN 초기값은 <b>전화번호 뒷6자리</b>입니다.</p>
          <p className="text-xs text-blue-700">예: 010-1234-<b>5678</b>90 → PIN: <b>345678</b></p>
          <p className="text-xs text-blue-700">변경 후에는 새 PIN으로만 본인확인이 가능합니다.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="이름 입력"
            className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">현재 PIN (6자리)</label>
          <input type="password" inputMode="numeric" maxLength={6} value={currentPin}
            onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="현재 PIN 6자리"
            className="w-full text-sm border border-line rounded-lg px-3 py-2.5 tracking-widest" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">새 PIN (6자리)</label>
          <input type="password" inputMode="numeric" maxLength={6} value={newPin}
            onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="새 PIN 6자리"
            className="w-full text-sm border border-line rounded-lg px-3 py-2.5 tracking-widest" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">새 PIN 확인</label>
          <input type="password" inputMode="numeric" maxLength={6} value={confirmPin}
            onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="새 PIN 다시 입력"
            className="w-full text-sm border border-line rounded-lg px-3 py-2.5 tracking-widest" />
          {confirmPin.length === 6 && newPin.length === 6 && confirmPin !== newPin && (
            <p className="text-xs text-red-500 mt-1">PIN이 일치하지 않습니다.</p>
          )}
          {confirmPin.length === 6 && newPin.length === 6 && confirmPin === newPin && (
            <p className="text-xs text-green-600 mt-1">✅ PIN 일치</p>
          )}
        </div>

        <button onClick={handleChangePin}
          disabled={submitting || !name.trim() || currentPin.length !== 6 || newPin.length !== 6 || newPin !== confirmPin}
          className="w-full bg-accent text-white py-3 rounded-lg font-semibold text-sm
            hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? '변경 중...' : '🔑 PIN 변경하기'}
        </button>
      </div>
    </div>
  )
}
