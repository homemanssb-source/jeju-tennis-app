import { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { ToastContext } from '../App'

const DIVISIONS = ['\uC9C0\uB3C4\uC790\uBD80','\uB9C8\uC2A4\uD130\uBD80','\uBCA0\uD14C\uB791\uBD80','\uC2E0\uC778\uBD80','\uC5EC\uC790\uB9C8\uC2A4\uD130\uBD80','\uC5EC\uC790\uBCA0\uD14C\uB791\uBD80','\uC5EC\uC790\uC2E0\uC778\uBD80']

export default function RegisterPage() {
  const showToast = useContext(ToastContext)
  const [grades, setGrades] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [form, setForm] = useState({
    name: '', gender: '', phone: '', club: '', division: '', grade: '',
  })

  useEffect(() => { fetchGrades() }, [])

  async function fetchGrades() {
    const { data } = await supabase.rpc('get_grade_options')
    if (data) setGrades(data.map(d => d.grade_value))
  }

  function handleChange(key, value) { setForm({ ...form, [key]: value }) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.gender || !form.phone || !form.club || !form.division || !form.grade) {
      showToast?.('\uC774\uB984, \uC131\uBCC4, \uC804\uD654\uBC88\uD638, \uC18C\uC18D\uD074\uB7FD, \uB7AD\uD0B9\uBD80\uC11C, \uB4F1\uAE09\uC740 \uD544\uC218\uC785\uB2C8\uB2E4.', 'error')
      return
    }
    if (!agreed) { showToast?.('\uC57D\uAD00\uC5D0 \uB3D9\uC758\uD574\uC8FC\uC138\uC694.', 'error'); return }

    setSubmitting(true)
    const memberId = 'M' + Date.now().toString().slice(-8)
    const nameNorm = form.name.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase()

    const { error } = await supabase.from('members').insert([{
      member_id: memberId, name: form.name, display_name: form.name, name_norm: nameNorm,
      gender: form.gender, phone: form.phone, club: form.club, division: form.division,
      grade: form.grade, status: '\uD734\uBA74', grade_source: 'auto',
      registered_at: new Date().toISOString(),
    }])

    if (error) showToast?.('\uB4F1\uB85D \uC2E4\uD328: ' + error.message, 'error')
    else { setSubmitted(true); showToast?.('\uB3D9\uD638\uC778 \uB4F1\uB85D \uC2E0\uCCAD\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4!') }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="pb-20">
        <PageHeader title={'\uD83D\uDC64 \uB3D9\uD638\uC778\uB4F1\uB85D'} />
        <div className="max-w-lg mx-auto px-5 py-12 text-center">
          <p className="text-5xl mb-4">{'\uD83C\uDF89'}</p>
          <h2 className="text-lg font-bold text-gray-900 mb-2">{'\uB4F1\uB85D \uC2E0\uCCAD \uC644\uB8CC!'}</h2>
          <p className="text-sm text-sub mb-4">{'\uB4F1\uB85D\uBE44 \uB0A9\uBD80 \uD6C4 \uD68C\uC6D0 \uD65C\uC131\uD654\uB429\uB2C8\uB2E4.'}</p>
          <div className="bg-soft rounded-lg p-4 text-left">
            <p className="text-sm font-semibold mb-2">{'\uD83D\uDCB0 \uB4F1\uB85D\uBE44 \uC548\uB0B4'}</p>
            <p className="text-sm text-gray-700">{'\uC81C\uC8FC\uC740\uD589 \uACC4\uC88C\uB85C \uB4F1\uB85D\uBE44\uB97C \uC785\uAE08\uD574\uC8FC\uC138\uC694.'}</p>
            <p className="text-sm text-gray-700 mt-1">{'\uC785\uAE08\uC790\uBA85\uC740 '}<b>{'\uBCF8\uC778 \uC774\uB984'}</b>{'\uC73C\uB85C \uD574\uC8FC\uC138\uC694.'}</p>
            <p className="text-xs text-sub mt-2">{'\uC785\uAE08 \uD655\uC778 \uD6C4 \uAD00\uB9AC\uC790\uAC00 \uD65C\uC131\uD654\uD569\uB2C8\uB2E4.'}</p>
          </div>
          <button onClick={() => { setSubmitted(false); setForm({ name: '', gender: '', phone: '', club: '', division: '', grade: '' }); setAgreed(false) }}
            className="mt-6 text-sm text-accent hover:underline">
            {'\uB2E4\uB978 \uB3D9\uD638\uC778 \uB4F1\uB85D\uD558\uAE30'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <PageHeader title={'\uD83D\uDC64 \uB3D9\uD638\uC778\uB4F1\uB85D'} subtitle={'\uB3D9\uD638\uC778\uD68C \uD68C\uC6D0 \uB4F1\uB85D \uC2E0\uCCAD'} />
      <div className="max-w-lg mx-auto px-5 py-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-amber-700">{'\u26A0\uFE0F \uB4F1\uB85D \uD6C4 '}<b>{'\uB4F1\uB85D\uBE44 \uB0A9\uBD80'}</b>{'\uAC00 \uD655\uC778\uB418\uBA74 \uAD00\uB9AC\uC790\uAC00 \uD65C\uC131\uD654\uD569\uB2C8\uB2E4.'}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {'\uC774\uB984 '}<span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)}
              placeholder={'\uC2E4\uBA85 \uC785\uB825'}
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {'\uC131\uBCC4 '}<span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              {['\uB0A8', '\uC5EC'].map(g => (
                <button key={g} type="button" onClick={() => handleChange('gender', g)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors
                    ${form.gender === g ? 'bg-accent text-white border-accent' : 'bg-white text-sub border-line hover:bg-soft'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {'\uC804\uD654\uBC88\uD638 '}<span className="text-red-500">*</span>
            </label>
            <input type="tel" value={form.phone} onChange={e => handleChange('phone', e.target.value)}
              placeholder="010-0000-0000"
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {'\uC18C\uC18D \uD074\uB7FD '}<span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.club} onChange={e => handleChange('club', e.target.value)}
              placeholder={'\uC18C\uC18D \uD074\uB7FD\uBA85'}
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {'\uB7AD\uD0B9\uBD80\uC11C '}<span className="text-red-500">*</span>
            </label>
            <select value={form.division} onChange={e => handleChange('division', e.target.value)}
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft">
              <option value="">{'\uC120\uD0DD\uD558\uC138\uC694'}</option>
              {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {'\uB4F1\uAE09 '}<span className="text-red-500">*</span>
            </label>
            <select value={form.grade} onChange={e => handleChange('grade', e.target.value)}
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accentSoft">
              <option value="">{'\uC120\uD0DD\uD558\uC138\uC694'}</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="bg-soft rounded-lg p-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="rounded mt-0.5" />
              <span className="text-sm text-gray-700">
                {'\uAC1C\uC778\uC815\uBCF4 \uC218\uC9D1 \uBC0F \uC774\uC6A9\uC5D0 \uB3D9\uC758\uD569\uB2C8\uB2E4.'}
                <span className="block text-xs text-sub mt-1">
                  {'\uC218\uC9D1\uD56D\uBAA9: \uC774\uB984, \uC131\uBCC4, \uC5F0\uB77D\uCC98, \uC18C\uC18D\uD074\uB7FD / \uC774\uC6A9\uBAA9\uC801: \uB3D9\uD638\uC778\uD68C \uC6B4\uC601 \uBC0F \uB300\uD68C \uAD00\uB9AC'}
                </span>
              </span>
            </label>
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-accent text-white py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
            {submitting ? '\uCC98\uB9AC \uC911...' : '\uB3D9\uD638\uC778 \uB4F1\uB85D \uC2E0\uCCAD'}
          </button>
          <p className="text-xs text-sub text-center">{'\uB4F1\uB85D \uD6C4 \uB4F1\uB85D\uBE44 \uB0A9\uBD80 \uD655\uC778 \uC2DC \uD65C\uC131\uD654\uB429\uB2C8\uB2E4.'}</p>
        </form>
      </div>
    </div>
  )
}