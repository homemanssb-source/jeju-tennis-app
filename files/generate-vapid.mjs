// generate-vapid.mjs
// 딱 한 번만 실행 → 출력된 키를 Vercel 환경변수에 등록
// 실행: node generate-vapid.mjs

import { generateVAPIDKeys } from 'web-push'

const keys = generateVAPIDKeys()
console.log('\n✅ VAPID 키 생성 완료! 아래 값을 Vercel 환경변수에 등록하세요:\n')
console.log('VITE_VAPID_PUBLIC_KEY =', keys.publicKey)
console.log('VAPID_PRIVATE_KEY     =', keys.privateKey)
console.log('\n⚠️  VAPID_PRIVATE_KEY 는 절대 프론트엔드 코드에 넣지 마세요!')
console.log('⚠️  이 키는 한 번 생성하면 바꾸지 마세요 (바꾸면 기존 구독자 전부 재구독 필요)\n')
