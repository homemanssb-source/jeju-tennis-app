// src/pages/PrivacyPage.jsx — 개인정보처리방침 (플레이스토어 등재 필수)
import { useNavigate } from 'react-router-dom'

const SECTIONS = [
  {
    title: '1. 수집하는 개인정보 항목',
    body: [
      '동호인 등록 시: 이름, 성별, 전화번호, 소속 클럽, 랭킹 부서, 등급',
      '선수 등록 시: 이름, 성별, 생년월일, 소속, 보호자 연락처, 선수 본인 연락처(선택)',
      '대회 참가 신청 시: 위 회원 정보 및 참가 종목, 파트너 정보',
      '자동 수집: 서비스 이용 기록(접속 페이지, 접속 일시), 푸시 알림 수신 동의 시 기기 푸시 토큰',
    ],
  },
  {
    title: '2. 개인정보의 수집 및 이용 목적',
    body: [
      '제주시테니스협회 회원 관리 및 동호인회 운영',
      '대회 참가 접수, 조편성, 대진표 작성 및 결과·랭킹 관리',
      '대회 일정, 접수 마감 등 협회 소식 알림 발송(수신 동의자에 한함)',
      '서비스 이용 통계 분석 및 서비스 개선',
    ],
  },
  {
    title: '3. 개인정보의 보유 및 이용 기간',
    body: [
      '회원 정보: 회원 자격 유지 기간 동안 보유하며, 탈퇴(삭제) 요청 시 지체 없이 파기합니다.',
      '대회 기록(참가 이력, 경기 결과, 랭킹 포인트): 협회 공식 기록 관리를 위해 보존됩니다.',
      '접속 기록: 수집일로부터 1년 이내 파기합니다.',
    ],
  },
  {
    title: '4. 개인정보의 제3자 제공',
    body: [
      '협회는 이용자의 개인정보를 외부에 판매하거나 제공하지 않습니다.',
      '다만 대회 운영을 위해 대진표·경기 결과·랭킹에 이름, 소속 클럽, 등급이 공개될 수 있습니다.',
    ],
  },
  {
    title: '5. 개인정보 처리의 위탁',
    body: [
      '데이터 보관: Supabase Inc. (데이터베이스 호스팅)',
      '서비스 호스팅: Vercel Inc. (웹/앱 호스팅)',
      '수탁사는 위탁 업무 수행 목적 외에 개인정보를 처리하지 않습니다.',
    ],
  },
  {
    title: '6. 이용자의 권리',
    body: [
      '이용자는 언제든지 본인의 개인정보에 대한 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다.',
      '요청은 아래 문의처로 연락 주시면 지체 없이 처리합니다.',
    ],
  },
  {
    title: '7. 개인정보의 파기',
    body: [
      '보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 전자적 파일 형태의 경우 복구할 수 없는 방법으로 삭제합니다.',
    ],
  },
  {
    title: '8. 개인정보 보호책임자 및 문의처',
    body: [
      '제주시테니스협회',
      '문의: 앱 내 "건의/문의" 게시판 또는 협회 사무국',
    ],
  },
]

export default function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen" style={{ background: '#faf6f1', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif" }}>
      {/* 헤더 */}
      <div style={{ background: '#fff8f3', padding: '18px 20px', borderBottom: '1px solid #f0e8e0' }}>
        <div style={{ maxWidth: 512, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', fontSize: 20, color: '#c0612b', cursor: 'pointer', padding: 0 }}>
            ←
          </button>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#2d1a0e' }}>개인정보처리방침</h1>
        </div>
      </div>

      <div style={{ maxWidth: 512, margin: '0 auto', padding: '20px 20px 80px' }}>
        <p style={{ fontSize: 12, color: '#7a6a62', lineHeight: 1.7, marginBottom: 20 }}>
          제주시테니스협회(이하 "협회")는 「개인정보 보호법」 등 관련 법령을 준수하며,
          이용자의 개인정보를 아래와 같이 처리합니다.
        </p>

        {SECTIONS.map(sec => (
          <div key={sec.title} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, boxShadow: '0 2px 8px rgba(192,97,43,0.05)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: '#2d1a0e' }}>{sec.title}</h2>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {sec.body.map((line, i) => (
                <li key={i} style={{ fontSize: 12, color: '#5a4a42', lineHeight: 1.7 }}>{line}</li>
              ))}
            </ul>
          </div>
        ))}

        <p style={{ fontSize: 11, color: '#c8a898', marginTop: 16 }}>
          본 방침은 2026년 8월 16일부터 적용됩니다.
        </p>
      </div>
    </div>
  )
}
