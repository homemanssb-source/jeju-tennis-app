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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// 임시 비밀번호: 헷갈리는 글자(0/O, 1/l/I) 제외 8자
function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const buf = new Uint32Array(8)
  crypto.getRandomValues(buf)
  return Array.from(buf, n => chars[n % chars.length]).join('')
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
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  // 회원 PIN 초기화용
  const [pinMemberSearch, setPinMemberSearch] = useState('')
  const [pinMembers, setPinMembers] = useState([])
  const [pinSearchLoading, setPinSearchLoading] = useState(false)

  useEffect(() => { fetchAdmins() }, [])

  async function fetchAdmins() {
    setLoading(true)
    const { data, error } = await supabase.from('admin_users').select('*')
    if (error) console.error('admin_users 조회 실패:', error)
    setAdmins(data || [])
    setLoading(false)
  }

  // ─── 관리자 추가 ───────────────────────────────
  // 로그인 계정은 Supabase 대시보드(Authentication → Users → Add user)에서 먼저 만든다.
  // 공개 회원가입을 막았기 때문에 앱에서 signUp 으로 계정을 만들 수 없다.
  // 여기서는 그 계정에 관리자 권한(admin_users)만 부여한다. (슈퍼관리자만 가능 — DB 정책)
  async function handleAdd() {
    if (!form.email.trim() || !form.name.trim()) {
      showToast?.('이메일과 이름을 입력해주세요.', 'error'); return
    }

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
  // 다른 사용자 비밀번호 변경은 service role 이 필요 → Edge Function(admin-reset-password) 호출.
  // 함수에서 호출자가 슈퍼관리자인지, 대상이 슈퍼가 아닌지 다시 확인한다.
  async function handlePasswordReset() {
    if (!selected) return
    if (newPassword.length < 6) { showToast?.('비밀번호는 6자 이상이어야 합니다.', 'error'); return }

    setResetting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('관리자 로그인이 필요합니다.')
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email: selected.email, password: newPassword }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '초기화 실패')
    } catch (e) {
      showToast?.('비밀번호 초기화 실패: ' + e.message, 'error')
      setResetting(false)
      return
    }

    await writeLog({
      adminEmail: adminUser.email,
      adminName: adminUser.name,
      action: 'UPDATE',
      targetTable: 'admin_users',
      targetId: selected.email,
      targetLabel: `관리자 비밀번호 초기화: ${selected.name}`,
    })

    setResetDone(true)
    setResetting(false)
    showToast?.(`${selected.name} 관리자 비밀번호가 초기화되었습니다.`)
  }

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
    setNewPassword(randomPassword())
    setResetDone(false)
    setModal('password')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">⚙️ 관리자 계정 관리</h2>
        <button
          onClick={() => {
            setForm({ email: '', name: '', is_super: false, permissions: { ...DEFAULT_PERMISSIONS } })
            setNewPassword('')
            setModal('add')
          }}
          style={{ backgroundColor: '#2563eb', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer' }}
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
                      {!admin.is_super && (
                        <>
                          <button onClick={() => openPasswordReset(admin)} className="text-xs text-amber-600 hover:underline">비번초기화</button>
                          <button onClick={() => handleDelete(admin)} className="text-xs text-red-500 hover:underline">삭제</button>
                        </>
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
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800 leading-relaxed">
                  ⚠️ 로그인 계정을 먼저 만들어주세요.<br />
                  <b>Supabase 대시보드 → Authentication → Users → Add user</b>에서
                  같은 이메일과 초기 비밀번호로 계정을 만들고 <b>Auto Confirm User</b>를 체크하세요.
                  그다음 여기서 추가하면 관리자 권한이 부여됩니다. (슈퍼관리자만 가능)
                </p>
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

            {resetDone ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-800 mb-2">✅ 초기화 완료</p>
                <p className="text-xs text-green-700 leading-relaxed mb-2">
                  아래 임시 비밀번호를 본인에게 전달하고, 로그인 후 바로 변경하도록 안내해주세요.
                </p>
                <p className="text-center font-mono text-lg font-bold tracking-wider bg-white rounded-lg py-2 select-all">
                  {newPassword}
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-sub mb-1">새 비밀번호 (6자 이상)</label>
                <div className="flex gap-2">
                  <input type="text" value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoComplete="off"
                    className="flex-1 text-sm font-mono border border-line rounded-lg px-3 py-2" />
                  <button onClick={() => setNewPassword(randomPassword())}
                    className="text-xs px-3 border border-line rounded-lg text-sub hover:bg-soft">다시 생성</button>
                </div>
                <p className="text-xs text-sub mt-2">본인 확인 후 초기화하세요. 기존 비밀번호는 더 이상 쓸 수 없습니다.</p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setModal(null); setNewPassword('') }}
                className="flex-1 py-2 border border-line rounded-lg text-sm text-sub">닫기</button>
              {!resetDone && (
                <button onClick={handlePasswordReset} disabled={resetting}
                  className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {resetting ? '초기화 중...' : '초기화'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}