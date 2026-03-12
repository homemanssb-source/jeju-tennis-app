import { useState, useEffect, useContext } from 'react'
import { supabase, writeLog } from '../../lib/supabase'
import { ToastContext } from '../../App'
import { useAdmin } from './AdminLayout'

const DEFAULT_PERMISSIONS = {
  members: false,
  events: false,
  payments: false,
  rankings: false,
  notices: false,
}

const PERM_LABELS = {
  members: '👥 회원',
  events: '🏆 대회',
  payments: '💰 결제',
  rankings: '📊 랭킹',
  notices: '📢 공지',
}

export default function AdminManagerPage() {
  const showToast = useContext(ToastContext)
  const adminUser = useAdmin()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'add' | 'edit' | 'password' | 'pin'
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ email: '', name: '', is_super: false, permissions: { ...DEFAULT_PERMISSIONS } })
  const [newPassword, setNewPassword] = useState('')

  // 회원 PIN 초기화용
  const [pinMemberSearch, setPinMemberSearch] = useState('')
  const [pinMembers, setPinMembers] = useState([])
  const [pinSearchLoading, setPinSearchLoading] = useState(false)

  useEffect(() => { fetchAdmins() }, [])

  async function fetchAdmins() {
    setLoading(true)
    const { data } = await supabase.from('admin_users').select('*').order('created_at')
    setAdmins(data || [])
    setLoading(false)
  }

  // ─── 관리자 추가 ───────────────────────────────
  async function handleAdd() {
    if (!form.email.trim() || !form.name.trim()) {
      showToast?.('이메일과 이름을 입력해주세요.', 'error'); return
    }
    if (!newPassword || newPassword.length < 6) {
      showToast?.('비밀번호는 6자 이상이어야 합니다.', 'error'); return
    }

    // Supabase Auth에 계정 생성 (signUp 방식 - 이메일 인증 없이 바로 사용 가능하게 설정 필요)
    const { error: signupError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: newPassword,
    })
    if (signupError) { showToast?.('계정 생성 실패: ' + signupError.message, 'error'); return }

    const { error } = await supabase.from('admin_users').insert([{
      email: form.email.trim(),
      name: form.name.trim(),
      is_super: form.is_super,
      permissions: form.permissions,
      created_by: adminUser.email,
    }])

    if (error) { showToast?.('관리자 추가 실패: ' + error.message, 'error'); return }

    await writeLog({
      adminEmail: adminUser.email,
      adminName: adminUser.name,
      action: 'CREATE',
      targetTable: 'admin_users',
      targetId: form.email,
      targetLabel: `관리자 추가: ${form.name}`,
      afterData: { email: form.email, name: form.name, permissions: form.permissions },
    })

    showToast?.(`${form.name} 관리자가 추가되었습니다.`)
    setModal(null)
    setNewPassword('')
    setForm({ email: '', name: '', is_super: false, permissions: { ...DEFAULT_PERMISSIONS } })
    fetchAdmins()
  }

  // ─── 관리자 권한 수정 ──────────────────────────
  async function handleEdit() {
    if (!selected) return
    const before = admins.find(a => a.id === selected.id)
    const { error } = await supabase.from('admin_users')
      .update({ name: form.name, is_super: form.is_super, permissions: form.permissions })
      .eq('id', selected.id)

    if (error) { showToast?.('수정 실패: ' + error.message, 'error'); return }

    await writeLog({
      adminEmail: adminUser.email,
      adminName: adminUser.name,
      action: 'UPDATE',
      targetTable: 'admin_users',
      targetId: selected.email,
      targetLabel: `관리자 수정: ${form.name}`,
      beforeData: { name: before.name, permissions: before.permissions, is_super: before.is_super },
      afterData: { name: form.name, permissions: form.permissions, is_super: form.is_super },
    })

    showToast?.('수정되었습니다.')
    setModal(null)
    fetchAdmins()
  }

  // ─── 관리자 삭제 ───────────────────────────────
  async function handleDelete(admin) {
    if (admin.is_super) { showToast?.('슈퍼어드민은 삭제할 수 없습니다.', 'error'); return }
    if (!confirm(`${admin.name} 관리자를 삭제하시겠습니까?`)) return

    const { error } = await supabase.from('admin_users').delete().eq('id', admin.id)
    if (error) { showToast?.('삭제 실패: ' + error.message, 'error'); return }

    await writeLog({
      adminEmail: adminUser.email,
      adminName: adminUser.name,
      action: 'DELETE',
      targetTable: 'admin_users',
      targetId: admin.email,
      targetLabel: `관리자 삭제: ${admin.name}`,
      beforeData: { email: admin.email, name: admin.name },
    })

    showToast?.(`${admin.name} 관리자가 삭제되었습니다.`)
    fetchAdmins()
  }

  // ─── 관리자 비밀번호 초기화 ───────────────────
  // anon key로는 다른 사용자 비밀번호 변경 불가 → 모달에서 Supabase 대시보드 안내만 표시

  // ─── 회원 PIN 검색 ─────────────────────────────
  async function searchPinMembers(q) {
    if (!q.trim()) { setPinMembers([]); return }
    setPinSearchLoading(true)
    const { data } = await supabase.from('members')
      .select('member_id, name, display_name, phone')
      .or(`name.ilike.%${q}%,member_id.ilike.%${q}%`)
      .neq('status', '탈퇴')
      .limit(10)
    setPinMembers(data || [])
    setPinSearchLoading(false)
  }

  // ─── 회원 PIN 초기화 ───────────────────────────
  async function handlePinReset(member) {
    if (!confirm(`${member.name} 회원의 PIN을 전화번호 뒷 6자리로 초기화하시겠습니까?`)) return

    const { data, error } = await supabase.rpc('admin_reset_member_pin', {
      p_member_id: member.member_id,
    })

    if (error || !data?.ok) {
      showToast?.(data?.message || error?.message || 'PIN 초기화 실패', 'error'); return
    }

    await writeLog({
      adminEmail: adminUser.email,
      adminName: adminUser.name,
      action: 'UPDATE',
      targetTable: 'members',
      targetId: member.member_id,
      targetLabel: `회원 PIN 초기화: ${member.name}`,
    })

    showToast?.(`${member.name} 회원 PIN이 초기화되었습니다.`)
    setPinMemberSearch('')
    setPinMembers([])
  }

  function openEdit(admin) {
    setSelected(admin)
    setForm({
      email: admin.email,
      name: admin.name,
      is_super: admin.is_super,
      permissions: { ...DEFAULT_PERMISSIONS, ...admin.permissions },
    })
    setModal('edit')
  }

  function openPasswordReset(admin) {
    setSelected(admin)
    setModal('password')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">⚙️ 관리자 계정 관리</h2>
        <button
          onClick={() => { setForm({ email: '', name: '', is_super: false, permissions: { ...DEFAULT_PERMISSIONS } }); setNewPassword(''); setModal('add') }}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + 관리자 추가
        </button>
      </div>

      {/* ── 관리자 목록 ── */}
      <div className="bg-white rounded-xl border border-line overflow-hidden">
        {loading ? (
          <p className="text-sm text-sub text-center py-8">불러오는 중...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-soft2">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-sub font-medium">이름</th>
                <th className="px-4 py-2 text-left text-xs text-sub font-medium">이메일</th>
                <th className="px-4 py-2 text-left text-xs text-sub font-medium">권한</th>
                <th className="px-4 py-2 text-center text-xs text-sub font-medium">옵션</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(admin => (
                <tr key={admin.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <span className="font-medium">{admin.name}</span>
                    {admin.is_super && <span className="ml-2 text-xs bg-accent text-white px-1.5 py-0.5 rounded">슈퍼</span>}
                  </td>
                  <td className="px-4 py-3 text-sub text-xs">{admin.email}</td>
                  <td className="px-4 py-3">
                    {admin.is_super ? (
                      <span className="text-xs text-accent font-medium">전체</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(admin.permissions || {}).filter(([, v]) => v).map(([k]) => (
                          <span key={k} className="text-[10px] bg-soft2 text-gray-600 px-1.5 py-0.5 rounded">
                            {PERM_LABELS[k] || k}
                          </span>
                        ))}
                        {!Object.values(admin.permissions || {}).some(Boolean) && (
                          <span className="text-xs text-red-400">권한없음</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openEdit(admin)} className="text-xs text-accent hover:underline">수정</button>
                      <button onClick={() => openPasswordReset(admin)} className="text-xs text-amber-600 hover:underline">비번초기화</button>
                      {!admin.is_super && (
                        <button onClick={() => handleDelete(admin)} className="text-xs text-red-500 hover:underline">삭제</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 회원 PIN 초기화 섹션 ── */}
      <div className="bg-white rounded-xl border border-line p-4">
        <h3 className="text-sm font-bold mb-3">🔑 회원 PIN 초기화</h3>
        <p className="text-xs text-sub mb-3">초기화하면 전화번호 뒤 6자리로 PIN이 재설정됩니다.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={pinMemberSearch}
            onChange={e => { setPinMemberSearch(e.target.value); searchPinMembers(e.target.value) }}
            placeholder="회원 이름 또는 ID 검색..."
            className="flex-1 text-sm border border-line rounded-lg px-3 py-2"
          />
        </div>
        {pinSearchLoading && <p className="text-xs text-sub mt-2">검색 중...</p>}
        {pinMembers.length > 0 && (
          <div className="mt-2 border border-line rounded-lg overflow-hidden">
            {pinMembers.map(m => (
              <div key={m.member_id} className="flex items-center justify-between px-3 py-2.5 border-b border-line/50 last:border-0">
                <div>
                  <span className="text-sm font-medium">{m.name}</span>
                  <span className="text-xs text-sub ml-2">{m.member_id}</span>
                  {m.phone && <span className="text-xs text-sub ml-2">📱 {m.phone}</span>}
                </div>
                <button
                  onClick={() => handlePinReset(m)}
                  className="text-xs bg-amber-500 text-white px-3 py-1 rounded-lg hover:bg-amber-600"
                >
                  PIN 초기화
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 모달: 관리자 추가 ── */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold">{modal === 'add' ? '관리자 추가' : '관리자 수정'}</h3>

            {modal === 'add' && (
              <div>
                <label className="block text-xs text-sub mb-1">이메일 *</label>
                <input type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@example.com"
                  className="w-full text-sm border border-line rounded-lg px-3 py-2" />
              </div>
            )}

            <div>
              <label className="block text-xs text-sub mb-1">이름 *</label>
              <input type="text" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="관리자 이름"
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>

            {modal === 'add' && (
              <div>
                <label className="block text-xs text-sub mb-1">초기 비밀번호 * (6자 이상)</label>
                <input type="password" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="초기 비밀번호"
                  className="w-full text-sm border border-line rounded-lg px-3 py-2" />
              </div>
            )}

            <div>
              <label className="block text-xs text-sub mb-2">탭 권한</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_super}
                    onChange={e => setForm({ ...form, is_super: e.target.checked })}
                    className="rounded" />
                  <span className="text-sm font-medium text-accent">슈퍼어드민 (전체 권한)</span>
                </label>
                {!form.is_super && Object.entries(PERM_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer ml-4">
                    <input type="checkbox"
                      checked={form.permissions[key] || false}
                      onChange={e => setForm({ ...form, permissions: { ...form.permissions, [key]: e.target.checked } })}
                      className="rounded" />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => { setModal(null); setNewPassword('') }}
                className="flex-1 py-2 border border-line rounded-lg text-sm text-sub">취소</button>
              <button onClick={modal === 'add' ? handleAdd : handleEdit}
                className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium">
                {modal === 'add' ? '추가' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 모달: 관리자 비밀번호 초기화 ── */}
      {modal === 'password' && selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-bold">🔐 비밀번호 초기화</h3>
            <p className="text-sm text-sub">{selected.name} ({selected.email})</p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ 직접 초기화 불가</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                보안상 앱에서 다른 관리자의 비밀번호를 직접 변경할 수 없습니다.<br /><br />
                아래 경로에서 직접 변경해주세요:<br />
                <b>Supabase 대시보드 → Authentication → Users → 해당 계정 클릭 → Reset password</b>
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2 border border-line rounded-lg text-sm text-sub">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
