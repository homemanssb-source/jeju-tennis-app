# 📱 플레이스토어 등재 가이드 (TWA)

JTA 제주 PWA를 그대로 안드로이드 앱으로 포장(TWA)해서 플레이스토어에 올리는 절차.
코드는 이미 준비 완료 — 아래 순서대로 진행하면 됩니다.

## ✅ 코드에 이미 반영된 것

- `public/manifest.json` — `id`, `scope`, `categories` 등 TWA 필수 필드 보완
- `public/.well-known/assetlinks.json` — 도메인 소유 증명 파일 (⚠️ 지문 교체 필요, 아래 4단계)
- `/privacy` 페이지 — 개인정보처리방침 (스토어 등록 시 URL 필수)
  - 홈 푸터, 회원등록 동의란에서 링크 연결됨

## 진행 순서

### 1. 배포 확인

- 이 변경사항을 커밋 & Vercel 배포
- 배포 후 브라우저에서 확인:
  - `https://jeju-tennis-app.vercel.app/privacy` → 개인정보처리방침 페이지가 뜨는지
  - `https://jeju-tennis-app.vercel.app/.well-known/assetlinks.json` → JSON이 그대로 뜨는지

### 2. 구글 플레이 개발자 계정 등록

- https://play.google.com/console 에서 등록 ($25, 1회)
- ⚠️ **가능하면 협회(조직) 계정으로 등록 권장**
  - 개인 계정(2023.11 이후 신규)은 정식 출시 전 **테스터 12명 × 14일 비공개 테스트** 의무
  - 조직 계정은 이 요건 면제 (D-U-N-S 번호 필요)

### 3. 안드로이드 패키지 생성 (PWABuilder)

1. https://www.pwabuilder.com 접속 → 배포 도메인 입력 → Start
2. 점수 확인 후 **Package for Stores → Android**
3. 설정값:
   - **Package ID**: `kr.jta.jeju.twa` (assetlinks.json과 반드시 일치)
   - App name: `JTA 제주시테니스`, Short name: `JTA`
   - Signing key: **"Create new"** 선택 (PWABuilder가 키 생성)
4. 다운로드된 zip 안의 파일:
   - `*.aab` → 플레이 콘솔에 업로드할 파일
   - `signing.keystore` + `signing-key-info.txt` → ⚠️ **분실 금지, 안전한 곳에 백업**
   - `assetlinks.json` → 참고용 (지문 값이 들어 있음)

### 4. assetlinks.json 지문 교체

앱 서명 지문(SHA-256)을 실제 값으로 교체해야 "상단에 브라우저 주소창 없는" 진짜 앱처럼 보입니다.

1. 플레이 콘솔에 `.aab` 업로드 후:
   **설정 → 앱 무결성 → 앱 서명(App signing)** 에서 **SHA-256 인증서 지문** 복사
   (Play App Signing을 쓰면 구글이 재서명하므로 반드시 **콘솔의 지문**을 사용)
2. `public/.well-known/assetlinks.json`의 `REPLACE_WITH_...` 부분을 복사한 지문으로 교체
3. 커밋 & 배포
4. 검증: https://developers.google.com/digital-asset-links/tools/generator
   (도메인 + 패키지명 + 지문 입력 → 확인)

### 5. 플레이 콘솔 스토어 등록정보

| 항목 | 내용 |
|------|------|
| 앱 이름 | JTA 제주시테니스 |
| 간단한 설명 (80자) | 제주시테니스협회 공식 앱 — 랭킹, 대회 신청, 공지를 한곳에서 |
| 자세한 설명 | 랭킹/포인트 조회, 대회 참가 신청, 공지사항, 선수 검색, 중고장터 등 |
| 카테고리 | 스포츠 |
| 개인정보처리방침 URL | `https://jeju-tennis-app.vercel.app/privacy` |
| 앱 아이콘 512×512 | `public/icon-512x512.png` 사용 가능 |
| 그래픽 이미지 1024×500 | 새로 제작 필요 (Canva 등) |
| 스크린샷 (휴대폰 최소 2장) | 폰에서 홈/랭킹 화면 캡처 |

**콘텐츠 등급 설문**: 소셜/커뮤니케이션 기능(게시판) 있음으로 응답 → 전체이용가 예상
**데이터 보안 섹션**: 수집 항목 = 이름, 전화번호 / 목적 = 계정 관리, 앱 기능 / 암호화 전송 = 예 / 삭제 요청 가능 = 예

### 6. 테스트 트랙 → 정식 출시

- 개인 계정인 경우: **비공개 테스트** 트랙에 올리고 협회 회원 12명+ 이메일 등록 → 14일 경과 후 정식 출시 신청
- 조직 계정인 경우: 바로 **프로덕션** 출시 가능
- 심사 기간: 보통 1~7일

## 이후 운영

- **앱 업데이트**: 웹만 Vercel에 배포하면 앱에 자동 반영. 스토어 재제출 불필요
- 스토어 재제출이 필요한 경우는 **앱 이름/아이콘/패키지 변경** 시 뿐
- 푸시 알림: 기존 웹푸시가 TWA 안에서 그대로 동작

## 참고

- 배포 도메인이 바뀌면 assetlinks.json 재검증 + PWABuilder 재패키징 필요
- iOS는 현 단계에서 스토어 등재 대신 Safari "홈 화면에 추가" (iOS 16.4+ 웹푸시 지원)
