import { useState, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'
import * as XLSX from 'xlsx'

export default function UploadAdmin() {
  const showToast = useContext(ToastContext)
  const [tab, setTab] = useState('member')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [detailModal, setDetailModal] = useState(null)

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f); setResult(null); setDetailModal(null)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'array', cellDates: false, raw: true })
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true })

      const PHONE_KEYS = ['전화번호', '휴대폰', '연락처']
      const normalized = data.map(row => {
        const r = { ...row }
        PHONE_KEYS.forEach(key => {
          if (r[key] !== undefined) {
            const v = r[key]
            // 숫자형으로 저장된 경우 앞의 0이 사라지므로 문자열 변환 후 0 복원
            let str = typeof v === 'number' ? v.toString() : (v || '').toString().trim()
            str = str.replace(/[^0-9]/g, '') // 하이픈 등 제거, 숫자만 남김
            if (str.length === 10 && str.startsWith('1')) str = '0' + str // 01x 복원
            else if (str.length === 9 && str.startsWith('2')) str = '0' + str // 02 지역번호
            r[key] = str
          }
        })
        if (r['등급']) {
          r['등급'] = r['등급'].toString().replace('점', '').trim()
        }
        return r
      })

      setPreview(normalized)
    }
    reader.readAsArrayBuffer(f)
  }

  function reset() { setFile(null); setPreview([]); setResult(null); setDetailModal(null) }

  async function uploadMembers() {
    if (!preview.length) { showToast?.('파일을 선택해주세요.', 'error'); return }
    setUploading(true)
    let successList = [], skippedList = [], errorList = []

    for (const row of preview) {
      const name = (row['이름'] || '').toString().trim()
      if (!name) { skippedList.push('빈 행 건너뜀'); continue }
      const gender = (row['성별(남/여)'] || row['성별'] || '').toString().trim()
      const phone = (row['전화번호'] || row['휴대폰'] || row['연락처'] || '').toString().trim()
      const club = (row['소속클럽'] || '').toString().trim()
      const division = (row['랭킹부서'] || '').toString().trim()
      const grade = (row['등급'] || '').toString().trim()
      const displayName = (row['표시이름(선택)'] || row['표시이름'] || '').toString().trim()

      if (!phone || !club || !division) { skippedList.push(`${name}: 필수항목 누락(전화번호/클럽/부서)`); continue }

      const { data: dup } = await supabase.from('members').select('member_id').eq('phone', phone).limit(1)
      if (dup && dup.length > 0) { skippedList.push(`${name} (${phone}): 이미 등록된 전화번호`); continue }

      const memberId = 'M' + Date.now().toString().slice(-6) + Math.random().toString(36).slice(-2)
      const { error } = await supabase.from('members').insert([{
        member_id: memberId, name, display_name: displayName || name,
        name_norm: name.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase(),
        gender: gender || null, phone, club, division,
        grade: grade || null, status: '휴면', grade_source: 'auto',
        registered_at: new Date().toISOString(),
      }])
      if (error) errorList.push(`${name}: ${error.message}`)
      else successList.push(`${name} (${phone}) → ${division}`)
    }
    setResult({ successList, skippedList, errorList })
    setUploading(false)
    showToast?.(`완료: ${successList.length}명 추가`)
  }

  async function uploadResults() {
    if (!preview.length) { showToast?.('파일을 선택해주세요.', 'error'); return }
    setUploading(true)
    let successList = [], skippedList = [], errorList = []
    const tournamentCache = {}

    const { data: pointRules } = await supabase.from('point_rules').select('*')
    const RANK_MAP = {
      '우승': 'points_1', '준우승': 'points_2',
      '4강': 'points_3', '3-4위': 'points_3', '3-4': 'points_3',
      '8강': 'points_4', '5-8위': 'points_4', '5-8': 'points_4',
      '16강': 'points_5', '9-16위': 'points_5', '9-16': 'points_5',
      '32강': 'points_6', '17-32위': 'points_6', '17-32': 'points_6',
      '참가': 'points_7', '33-64위': 'points_7', '33-64': 'points_7',
    }

    function autoCalcPoints(division, rank, manualPoints) {
      if (manualPoints && manualPoints > 0) return manualPoints
      if (!pointRules || !division || !rank) return 0
      const rule = pointRules.find(r => r.division === division)
      if (!rule) return 0
      const col = RANK_MAP[rank]
      return col ? (rule[col] || 0) : 0
    }

    for (const row of preview) {
      const memberName = (row['회원이름'] || row['선수명'] || row['이름'] || '').toString().trim()
      const phone = (row['전화번호'] || row['휴대폰'] || '').toString().trim()
      const memberClub = (row['클럽명'] || row['소속클럽'] || row['클럽'] || '').toString().trim()
      const tournamentName = (row['대회명'] || '').toString().trim()
      const dateStr = (row['대회일자(YYYY-MM-DD)'] || row['대회일자'] || row['일시'] || row['일자'] || '').toString().trim()
      const division = (row['부서'] || '').toString().trim()
      const rank = (row['순위(우승/준우승/4강/8강/참가)'] || row['순위'] || '').toString().trim()
      const manualPoints = parseInt(row['포인트'] || '0') || 0
      const points = autoCalcPoints(division, rank, manualPoints)

      if (!memberName || !tournamentName || !dateStr) {
        skippedList.push('빈 행 건너뜀(이름/대회명/일자 누락)'); continue
      }

      // ── 회원 매칭 (member_id + grade 동시 조회) ──
      let memberId = (row['회원ID'] || '').toString().trim()
      let memberGrade = null

      if (memberId) {
        // 회원ID가 CSV에 있으면 grade만 별도 조회
        const { data: found } = await supabase.from('members')
          .select('member_id, grade')
          .eq('member_id', memberId)
          .limit(1)
        if (found && found.length > 0) memberGrade = found[0].grade || null

      } else {
        // 이름+전화번호로 매칭
        if (phone) {
          const { data: found } = await supabase.from('members')
            .select('member_id, grade')
            .eq('name', memberName)
            .eq('phone', phone)
            .limit(1)
          if (found && found.length === 1) {
            memberId = found[0].member_id
            memberGrade = found[0].grade || null
          }
        }
        // 이름+클럽으로 매칭 (동명이인 해결)
        if (!memberId && memberClub) {
          const { data: found } = await supabase.from('members')
            .select('member_id, grade')
            .eq('name', memberName)
            .eq('club', memberClub)
          if (found && found.length === 1) {
            memberId = found[0].member_id
            memberGrade = found[0].grade || null
          }
        }
        // 이름만으로 매칭 (최후 fallback)
        if (!memberId) {
          const { data: found } = await supabase.from('members')
            .select('member_id, grade, club')
            .eq('name', memberName)
          if (found && found.length === 1) {
            memberId = found[0].member_id
            memberGrade = found[0].grade || null
          } else if (found && found.length > 1) {
            // 클럽명이 있으면 부분일치로 한번 더 좁히기 (띄어쓰기/오타 완화)
            if (memberClub) {
              const normClub = memberClub.replace(/\s+/g, '').toLowerCase()
              const byClub = found.filter(m =>
                (m.club || '').replace(/\s+/g, '').toLowerCase() === normClub
              )
              if (byClub.length === 1) {
                memberId = byClub[0].member_id
                memberGrade = byClub[0].grade || null
              } else {
                const clubList = found.map(m => m.club || '(무소속)').join(', ')
                errorList.push(`${memberName} (${memberClub}): 동명이인 ${found.length}명 중 클럽 매칭 실패 [후보: ${clubList}]`); continue
              }
            } else {
              errorList.push(`${memberName}: 동명이인 ${found.length}명 - 전화번호/클럽명/회원ID 필요`); continue
            }
          } else {
            errorList.push(`${memberName}${memberClub ? ` (${memberClub})` : ''}: 회원을 찾을 수 없음`); continue
          }
        }
      }

      // ── 날짜 파싱 ──
      let dateVal = dateStr
      if (!isNaN(dateStr) && Number(dateStr) > 10000) {
        const d = new Date(new Date(1899, 11, 30).getTime() + Number(dateStr) * 86400000)
        dateVal = d.toISOString().slice(0, 10)
      } else if (dateStr.includes('/')) {
        const p = dateStr.split('/')
        if (p[0].length === 4) dateVal = `${p[0]}-${p[1].padStart(2,'0')}-${p[2].padStart(2,'0')}`
        else dateVal = `${p[2]}-${p[0].padStart(2,'0')}-${p[1].padStart(2,'0')}`
      }
      const seasonYear = parseInt(dateVal.substring(0, 4)) || new Date().getFullYear()

      // ── tournaments_master 생성 (없을 때만) ──
      if (!tournamentCache[tournamentName]) {
        const { data: ex } = await supabase.from('tournaments_master')
          .select('tournament_id')
          .eq('tournament_name', tournamentName)
          .limit(1)
        if (!ex || ex.length === 0) {
          await supabase.from('tournaments_master').insert([{
            tournament_name: tournamentName, date: dateVal, year: dateVal.substring(0, 4)
          }])
        }
        tournamentCache[tournamentName] = true
      }

      // ── 중복 체크 ──
      const { data: dup } = await supabase.from('tournament_results')
        .select('id')
        .eq('member_id', memberId)
        .eq('tournament_name', tournamentName)
        .eq('division', division || '')
        .eq('season_year', seasonYear)
        .limit(1)
      if (dup && dup.length > 0) {
        skippedList.push(`${memberName} / ${tournamentName} / ${division}: 이미 등록됨`); continue
      }

      // ── insert (grade 자동매칭 포함) ──
      const { error } = await supabase.from('tournament_results').insert([{
        member_id: memberId,
        member_name: memberName,
        tournament_name: tournamentName,
        date: dateVal,
        season_year: seasonYear,
        division: division || null,
        rank: rank || '참가',
        points,
        grade: memberGrade, // ✅ members 테이블에서 자동매칭
      }])
      if (error) errorList.push(`${memberName}/${tournamentName}: ${error.message}`)
      else successList.push(`${memberName} → ${tournamentName} ${rank} +${points} (등급 ${memberGrade || '-'})`)
    }

    setResult({ successList, skippedList, errorList })
    setUploading(false)
    showToast?.(`완료: ${successList.length}건 등록`)
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">📤 엑셀 업로드</h2>
      <div className="flex gap-2 mb-4">
        <button onClick={() => { setTab('member'); reset() }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'member' ? 'bg-accent text-white' : 'bg-white border border-line text-sub'}`}>
          👥 회원 일괄 등록
        </button>
        <button onClick={() => { setTab('result'); reset() }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'result' ? 'bg-accent text-white' : 'bg-white border border-line text-sub'}`}>
          🏆 대회결과 등록
        </button>
      </div>

      <div className="bg-soft rounded-lg p-3 mb-4 text-xs text-gray-700 space-y-1">
        {tab === 'member' ? (
          <>
            <p className="font-semibold">회원 일괄 등록</p>
            <p>필수: 이름, 전화번호(또는 휴대폰), 소속클럽, 랭킹부서</p>
          </>
        ) : (
          <>
            <p className="font-semibold">대회결과 등록</p>
            <p>매칭: 회원ID → 이름+전화번호 → 이름만 (동명이인이면 에러)</p>
            <p className="text-green-700">✅ 출전등급은 회원 현재 등급에서 자동 매칭됩니다.</p>
          </>
        )}
      </div>

      <div className="mb-4">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
            file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-blue-700" />
      </div>

      {preview.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">미리보기 ({preview.length}건)</p>
            <button onClick={reset} className="text-xs text-red-500 hover:underline">초기화</button>
          </div>
          <div className="bg-white border border-line rounded-lg overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-soft2 sticky top-0">
                <tr>{Object.keys(preview[0]).map(key => (
                  <th key={key} className="px-2 py-1.5 text-left font-medium text-sub whitespace-nowrap">{key}</th>
                ))}</tr>
              </thead>
              <tbody>{preview.map((row, i) => (
                <tr key={i} className="border-t border-line/50">
                  {Object.values(row).map((val, j) => (
                    <td key={j} className="px-2 py-1.5 whitespace-nowrap">{String(val)}</td>
                  ))}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {preview.length > 0 && !result && (
        <button
          onClick={tab === 'member' ? uploadMembers : uploadResults}
          disabled={uploading}
          className="w-full bg-accent text-white py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50">
          {uploading ? '업로드 중...' : `📤 ${preview.length}건 업로드 실행`}
        </button>
      )}

      {result && (
        <div className="bg-white border border-line rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-bold">📊 업로드 결과</h3>
          <div className="flex gap-3">
            <button onClick={() => setDetailModal('success')}
              className="bg-green-50 text-green-700 px-3 py-2 rounded-lg hover:bg-green-100 transition-colors">
              <p className="text-[10px]">성공</p>
              <p className="text-lg font-bold">{result.successList.length}</p>
            </button>
            <button onClick={() => setDetailModal('skipped')}
              className="bg-yellow-50 text-yellow-700 px-3 py-2 rounded-lg hover:bg-yellow-100 transition-colors">
              <p className="text-[10px]">건너뜀</p>
              <p className="text-lg font-bold">{result.skippedList.length}</p>
            </button>
            <button onClick={() => setDetailModal('errors')}
              className="bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors">
              <p className="text-[10px]">오류</p>
              <p className="text-lg font-bold">{result.errorList.length}</p>
            </button>
          </div>
          <p className="text-xs text-sub">각 항목을 클릭하면 상세 명단을 볼 수 있습니다.</p>
          <button onClick={reset} className="text-sm text-accent hover:underline">다시 업로드하기</button>
        </div>
      )}

      {/* 상세 명단 모달 */}
      {detailModal && result && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setDetailModal(null)}>
          <div className="bg-white rounded-lg p-4 w-full max-w-md max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-bold ${
                detailModal === 'success' ? 'text-green-700' :
                detailModal === 'skipped' ? 'text-yellow-700' : 'text-red-600'
              }`}>
                {detailModal === 'success' ? '✅ 성공 명단' :
                 detailModal === 'skipped' ? '⏭️ 건너뜀 명단' : '❌ 오류 명단'}
                ({(detailModal === 'success' ? result.successList :
                   detailModal === 'skipped' ? result.skippedList : result.errorList).length}건)
              </h3>
              <button onClick={() => setDetailModal(null)} className="text-sub text-lg hover:text-gray-700">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const items = detailModal === 'success' ? result.successList :
                              detailModal === 'skipped' ? result.skippedList : result.errorList
                return items.length === 0 ? (
                  <p className="text-sm text-sub text-center py-4">항목이 없습니다.</p>
                ) : (
                  <div className="space-y-1">
                    {items.map((item, i) => (
                      <div key={i} className={`text-xs px-3 py-2 rounded ${
                        detailModal === 'success' ? 'bg-green-50' :
                        detailModal === 'skipped' ? 'bg-yellow-50' : 'bg-red-50'
                      }`}>{i + 1}. {item}</div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
