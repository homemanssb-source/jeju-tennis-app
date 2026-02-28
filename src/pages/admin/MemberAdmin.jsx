import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function MemberAdmin() {
  const showToast = useContext(ToastContext)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDiv, setFilterDiv] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClub, setFilterClub] = useState('')
  const [divisions, setDivisions] = useState([])
  const [clubs, setClubs] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [modal, setModal] = useState(null)
  const [editMember, setEditMember] = useState(null)
  const [gradeForm, setGradeForm] = useState({ newGrade: '', reason: '' })
  const [grades, setGrades] = useState([])
  const [form, setForm] = useState({
    member_id: '', name: '', display_name: '', phone: '',
    club: '', division: '', grade: '', gender: '', status: '\uD65C\uC131'
  })

  useEffect(() => { fetchMembers(); fetchGrades() }, [])

  async function fetchGrades() {
    const { data } = await supabase.rpc('get_grade_options')
    if (data) setGrades(data.map(d => d.grade_value))
  }

  async function fetchMembers() {
    setLoading(true)
    const { data } = await supabase.from('members').select('*').order('name')
    if (data) {
      setMembers(data)
      setDivisions([...new Set(data.map(m => m.division).filter(Boolean))])
      setClubs([...new Set(data.map(m => m.club).filter(Boolean))].sort())
    }
    setLoading(false)
  }

  const filtered = members.filter(m => {
    if (filterStatus && m.status !== filterStatus) return false
    if (filterDiv && m.division !== filterDiv) return false
    if (filterClub && m.club !== filterClub) return false
    if (search) {
      const q = search.toLowerCase()
      return (m.name || '').toLowerCase().includes(q) ||
        (m.member_id || '').toLowerCase().includes(q) ||
        (m.display_name || '').toLowerCase().includes(q) ||
        (m.club || '').toLowerCase().includes(q)
    }
    return true
  })

  function toggleSelect(id) {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(m => m.member_id)))
  }

  async function batchUpdateStatus(newStatus) {
    if (selected.size === 0) { showToast?.('\uD68C\uC6D0\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694.', 'error'); return }
    const label = newStatus === '\uD65C\uC131' ? '\uD65C\uC131\uD654' : '\uD734\uBA74 \uCC98\uB9AC'
    if (!confirm(`\uC120\uD0DD\uD55C ${selected.size}\uBA85\uC744 ${label}\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`)) return

    const ids = [...selected]
    const { error } = await supabase.from('members')
      .update({ status: newStatus })
      .in('member_id', ids)

    if (error) showToast?.('\uCC98\uB9AC \uC2E4\uD328: ' + error.message, 'error')
    else showToast?.(`${ids.length}\uBA85 ${label} \uC644\uB8CC!`)
    setSelected(new Set())
    fetchMembers()
  }

  function openAdd() {
    setForm({ member_id: 'M' + Date.now().toString().slice(-8), name: '', display_name: '', phone: '', club: '', division: '', grade: '', gender: '', status: '\uD65C\uC131' })
    setModal('add')
  }

  function openEdit(m) { setForm({ ...m }); setEditMember(m); setModal('edit') }

  function openGrade(m) { setEditMember(m); setGradeForm({ newGrade: '', reason: '' }); setModal('grade') }

  async function handleSave() {
    if (!form.member_id || !form.name) { showToast?.('\uD68C\uC6D0ID\uC640 \uC774\uB984\uC740 \uD544\uC218\uC785\uB2C8\uB2E4.', 'error'); return }
    if (modal === 'add') {
      const { error } = await supabase.from('members').insert([{ ...form, name_norm: form.name.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase() }])
      if (error) { showToast?.('\uCD94\uAC00 \uC2E4\uD328: ' + error.message, 'error'); return }
      showToast?.('\uD68C\uC6D0\uC774 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4.')
    } else {
      const { error } = await supabase.from('members').update(form).eq('member_id', editMember.member_id)
      if (error) { showToast?.('\uC218\uC815 \uC2E4\uD328: ' + error.message, 'error'); return }
      showToast?.('\uD68C\uC6D0 \uC815\uBCF4\uAC00 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4.')
    }
    setModal(null); fetchMembers()
  }

  async function handleDelete(m) {
    if (!confirm(`${m.name} \uD68C\uC6D0\uC744 \uC0AD\uC81C \uCC98\uB9AC\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`)) return
    await supabase.from('members').update({ status: '\uC0AD\uC81C' }).eq('member_id', m.member_id)
    showToast?.('\uC0AD\uC81C \uCC98\uB9AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.'); fetchMembers()
  }

  async function handleGradeChange() {
    if (!gradeForm.newGrade) { showToast?.('\uC0C8 \uB4F1\uAE09\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694.', 'error'); return }
    const { error } = await supabase.from('members')
      .update({ grade: gradeForm.newGrade, grade_source: 'manual' })
      .eq('member_id', editMember.member_id)
    if (error) { showToast?.('\uB4F1\uAE09 \uBCC0\uACBD \uC2E4\uD328: ' + error.message, 'error'); return }
    showToast?.(`${editMember.name}: ${editMember.grade || '\uC5C6\uC74C'} \u2192 ${gradeForm.newGrade}`)
    setModal(null); fetchMembers()
  }

  // \uD074\uB7FD\uBCC4 \uD1B5\uACC4
  const clubStats = {}
  filtered.forEach(m => {
    const c = m.club || '\uC18C\uC18D\uC5C6\uC74C'
    if (!clubStats[c]) clubStats[c] = { total: 0, active: 0, dormant: 0 }
    clubStats[c].total++
    if (m.status === '\uD65C\uC131') clubStats[c].active++
    else if (m.status === '\uD734\uBA74') clubStats[c].dormant++
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">{'\uD83D\uDC65 \uD68C\uC6D0 \uAD00\uB9AC'}</h2>
        <button onClick={openAdd}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + {'\uD68C\uC6D0 \uCD94\uAC00'}
        </button>
      </div>

      {/* \uD544\uD130 */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={'\uC774\uB984/\uD074\uB7FD \uAC80\uC0C9...'}
          className="flex-1 min-w-[120px] text-sm border border-line rounded-lg px-3 py-2" />
        <select value={filterClub} onChange={e => setFilterClub(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">{'\uC804\uCCB4 \uD074\uB7FD'}</option>
          {clubs.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterDiv} onChange={e => setFilterDiv(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">{'\uC804\uCCB4 \uBD80\uC11C'}</option>
          {divisions.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">{'\uC804\uCCB4 \uC0C1\uD0DC'}</option>
          <option value={'\uD65C\uC131'}>{'\uD65C\uC131'}</option>
          <option value={'\uD734\uBA74'}>{'\uD734\uBA74'}</option>
          <option value={'\uC0AD\uC81C'}>{'\uC0AD\uC81C'}</option>
        </select>
      </div>

      {/* \uC77C\uAD04 \uCC98\uB9AC \uBC84\uD2BC */}
      {selected.size > 0 && (
        <div className="flex gap-2 mb-3 items-center bg-blue-50 p-2 rounded-lg">
          <span className="text-sm font-medium text-accent">{selected.size}{'\uBA85 \uC120\uD0DD'}</span>
          <button onClick={() => batchUpdateStatus('\uD65C\uC131')}
            className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700">
            {'\u2705 \uC77C\uAD04 \uD65C\uC131\uD654 (\uB4F1\uB85D\uBE44 \uD655\uC778)'}
          </button>
          <button onClick={() => batchUpdateStatus('\uD734\uBA74')}
            className="bg-yellow-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-yellow-600">
            {'\u23F8\uFE0F \uC77C\uAD04 \uD734\uBA74'}
          </button>
          <button onClick={() => setSelected(new Set())}
            className="text-xs text-sub hover:underline ml-auto">{'\uC120\uD0DD \uD574\uC81C'}</button>
        </div>
      )}

      {/* \uD14C\uC774\uBE14 */}
      <div className="bg-white rounded-lg border border-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-soft2">
            <tr>
              <th className="px-2 py-2 text-center w-8">
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll} className="rounded" />
              </th>
              <th className="px-3 py-2 text-left font-medium text-sub">{'\uC774\uB984'}</th>
              <th className="px-3 py-2 text-left font-medium text-sub">{'\uC18C\uC18D'}</th>
              <th className="px-3 py-2 text-left font-medium text-sub">{'\uBD80\uC11C'}</th>
              <th className="px-3 py-2 text-left font-medium text-sub">{'\uB4F1\uAE09'}</th>
              <th className="px-3 py-2 text-left font-medium text-sub">{'\uC0C1\uD0DC'}</th>
              <th className="px-3 py-2 text-center font-medium text-sub">{'\uC561\uC158'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-sub">{'\uB85C\uB529 \uC911...'}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-sub">{'\uACB0\uACFC \uC5C6\uC74C'}</td></tr>
            ) : filtered.map(m => (
              <tr key={m.member_id} className={`border-t border-line hover:bg-soft ${selected.has(m.member_id) ? 'bg-blue-50/50' : ''}`}>
                <td className="px-2 py-2 text-center">
                  <input type="checkbox" checked={selected.has(m.member_id)}
                    onChange={() => toggleSelect(m.member_id)} className="rounded" />
                </td>
                <td className="px-3 py-2 font-medium">
                  {m.display_name || m.name}
                  {m.grade_source === 'manual' && <span className="ml-1 text-[10px] text-orange-500">{'\uC218\uB3D9'}</span>}
                </td>
                <td className="px-3 py-2 text-sub">{m.club || '-'}</td>
                <td className="px-3 py-2">{m.division || '-'}</td>
                <td className="px-3 py-2">
                  <span className="px-1.5 py-0.5 bg-accentSoft text-accent text-xs rounded">{m.grade || '-'}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    m.status === '\uD65C\uC131' ? 'bg-green-50 text-green-700' :
                    m.status === '\uD734\uBA74' ? 'bg-yellow-50 text-yellow-700' :
                    m.status === '\uC0AD\uC81C' ? 'bg-red-50 text-red-500' :
                    'bg-gray-100 text-gray-500'
                  }`}>{m.status}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => openEdit(m)} className="text-xs text-accent hover:underline">{'\uC218\uC815'}</button>
                    <button onClick={() => openGrade(m)} className="text-xs text-purple-600 hover:underline">{'\uB4F1\uAE09'}</button>
                    {m.status !== '\uC0AD\uC81C' && (
                      <button onClick={() => handleDelete(m)} className="text-xs text-red-500 hover:underline">{'\uC0AD\uC81C'}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-sub mt-2">{'\uCD4C ' + filtered.length + '\uBA85'}</p>

      {/* \uCD94\uAC00/\uC218\uC815 \uBAA8\uB2EC */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold mb-4">{modal === 'add' ? '\uD68C\uC6D0 \uCD94\uAC00' : '\uD68C\uC6D0 \uC218\uC815'}</h3>
            <div className="space-y-3">
              {[
                { key: 'member_id', label: '\uD68C\uC6D0 ID', disabled: modal === 'edit' },
                { key: 'name', label: '\uC774\uB984' },
                { key: 'display_name', label: '\uD45C\uC2DC\uBA85' },
                { key: 'phone', label: '\uC804\uD654\uBC88\uD638' },
                { key: 'club', label: '\uC18C\uC18D' },
              ].map(({ key, label, disabled }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-sub mb-1">{label}</label>
                  <input type="text" value={form[key] || ''}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    disabled={disabled}
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 disabled:bg-soft2" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-sub mb-1">{'\uBD80\uC11C'}</label>
                <select value={form.division || ''} onChange={e => setForm({ ...form, division: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2">
                  <option value="">{'\uC120\uD0DD'}</option>
                  {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-sub mb-1">{'\uB4F1\uAE09'}</label>
                <select value={form.grade || ''} onChange={e => setForm({ ...form, grade: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2">
                  <option value="">{'\uC120\uD0DD'}</option>
                  {grades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-sub mb-1">{'\uC131\uBCC4'}</label>
                <select value={form.gender || ''} onChange={e => setForm({ ...form, gender: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2">
                  <option value="">{'\uC120\uD0DD'}</option>
                  <option value={'\uB0A8'}>{'\uB0A8'}</option>
                  <option value={'\uC5EC'}>{'\uC5EC'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-sub mb-1">{'\uC0C1\uD0DC'}</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2">
                  <option value={'\uD65C\uC131'}>{'\uD65C\uC131'}</option>
                  <option value={'\uD734\uBA74'}>{'\uD734\uBA74'}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2 border border-line rounded-lg text-sm text-sub hover:bg-soft2">{'\uCDE8\uC18C'}</button>
              <button onClick={handleSave}
                className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-700">{'\uC800\uC7A5'}</button>
            </div>
          </div>
        </div>
      )}

      {/* \uB4F1\uAE09 \uBCC0\uACBD \uBAA8\uB2EC */}
      {modal === 'grade' && editMember && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-base font-bold mb-1">{'\uB4F1\uAE09 \uBCC0\uACBD'}</h3>
            <p className="text-sm text-sub mb-4">{editMember.name} ({'\uD604\uC7AC: ' + (editMember.grade || '\uC5C6\uC74C')})</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-sub mb-1">{'\uC0C8 \uB4F1\uAE09'}</label>
                <select value={gradeForm.newGrade} onChange={e => setGradeForm({ ...gradeForm, newGrade: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2">
                  <option value="">{'\uC120\uD0DD'}</option>
                  {grades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-sub mb-1">{'\uBCC0\uACBD \uC0AC\uC720'}</label>
                <textarea value={gradeForm.reason}
                  onChange={e => setGradeForm({ ...gradeForm, reason: e.target.value })}
                  placeholder={'\uC0AC\uC720\uB97C \uC785\uB825\uD558\uC138\uC694'}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2 h-20 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2 border border-line rounded-lg text-sm text-sub hover:bg-soft2">{'\uCDE8\uC18C'}</button>
              <button onClick={handleGradeChange}
                className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">{'\uB4F1\uAE09 \uBCC0\uACBD'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
