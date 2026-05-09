# StatScope KR 배포 가이드 (statscope.kr)

코드는 이미 준비되어 있습니다. Vercel에서 환경변수만 설정하면 자동으로 KR 버전이 배포됩니다.

---

## 1단계: 도메인 구매

- 구매 처: Namecheap, Godaddy, 또는 국내 호스팅사
- 도메인: **statscope.kr**
- 연간 비용: ~$10-15

---

## 2단계: Vercel 새 프로젝트 생성

### 2-1. Vercel 대시보드 접속
- https://vercel.com/dashboard
- 오른쪽 상단 **Add New** → **Project**

### 2-2. GitHub 저장소 선택
- **Import Git Repository** 클릭
- 검색: `statscope` (chooyoon/statscope)
- **Import** 클릭

### 2-3. 프로젝트 설정
**Project Name**: `statscope-kr` (또는 원하는 이름)
**Framework**: Automatically detected (Next.js)
**Root Directory**: `./` (기본값)

---

## 3단계: 환경변수 설정

### 3-1. Environment Variables 섹션 추가
**Configuration** 탭 → **Environment Variables** → **Add**

| Key | Value | Scope |
|-----|-------|-------|
| `NEXT_PUBLIC_REGION` | `kr` | Production, Preview, Development |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | (기존 값 복사) | Production, Preview |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | (기존 값 복사) | Production, Preview |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | (기존 값 복사) | Production, Preview |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | (기존 값 복사) | Production, Preview |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | (기존 값 복사) | Production, Preview |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | (기존 값 복사) | Production, Preview |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | (기존 값 복사) | Production, Preview |

**Firebase 값은 기존 statscope 프로젝트에서 확인:**
- Vercel Dashboard → statscope 프로젝트 → Settings → Environment Variables

### 3-2. "Add" 클릭해서 모두 추가

---

## 4단계: 빌드 & 배포

### 4-1. Deploy 클릭
Vercel이 자동으로 Next.js 빌드 시작
- 빌드 시간: ~3-5분
- 완료 후 기본 도메인 할당됨 (예: `statscope-kr.vercel.app`)

### 4-2. 빌드 완료 확인
- Deployments 탭에서 체크마크 (✓) 확인
- 기본 도메인 클릭해서 한국어로 표시되는지 확인

---

## 5단계: 도메인 연결

### 5-1. Vercel 도메인 설정
- Vercel Dashboard → statscope-kr 프로젝트
- **Settings** → **Domains**
- **Add Domain** 클릭
- `statscope.kr` 입력

### 5-2. DNS 설정 (Namecheap 기준)

Vercel이 안내하는 대로:
1. Namecheap 대시보드 → **Manage** (statscope.kr 옆)
2. **Nameservers** 섹션 → **Custom Nameserver** 선택
3. Vercel이 제공하는 네임서버 4개 입력:
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ns3.vercel-dns.com
   ns4.vercel-dns.com
   ```
4. **Save Changes**

### 5-3. DNS 전파 대기
- 보통 30분 ~ 2시간 소요
- Vercel 도메인 페이지에서 자동 확인됨
- 확인되면 ✓ 체크마크 표시

---

## 6단계: HTTPS 자동 설정

Vercel이 자동으로 Let's Encrypt SSL 인증서 발급
- 도메인 연결 후 ~5분 내 자동 적용
- https://statscope.kr 접속 확인

---

## 7단계: 테스트

### 7-1. statscope.kr 접속
```
https://statscope.kr
```

### 7-2 확인 사항
✅ 페이지 제목: "StatScope KR - MLB 심층 분석 플랫폼"  
✅ 네비게이션: "오늘의 경기", "팀 순위", "예측 성적" 등 한국어  
✅ 언어 토글 버튼: **없음** (항상 한국어)  
✅ 메타태그: 페이지 소스에 `ko_KR` locale 확인

---

## 8단계: 기존 사이트와 분리

### Analytics / AdSense 분리 (선택사항)
- US 버전과 KR 버전 분석을 따로 보고 싶으면
- Google Analytics / AdSense에서 각각 프로퍼티 추가
- `.env` 파일에서 `NEXT_PUBLIC_ADSENSE_CLIENT_ID`를 환경별로 다르게 설정

---

## 문제 해결

### Q: 도메인 연결 후에도 "Invalid configuration" 에러
**A**: DNS 전파 대기 (최대 48시간)

### Q: statscope.kr 접속하면 영어로 나옴
**A**: 브라우저 캐시 삭제 후 재접속
```
Ctrl+Shift+Delete (Windows) / Cmd+Shift+Delete (Mac)
→ Cookies 섹션에서 statscope.kr 삭제
```

### Q: Firebase 데이터가 공유되나?
**A**: **네**. 같은 Firebase 프로젝트 사용하므로 데이터 공유됨.
- US 버전의 픽 = KR 버전에서도 보임 (의도된 동작)
- 분리하려면 별도 Firebase 프로젝트 필요 (권장 안 함)

---

## 완료!

이제 두 도메인에서 동시에 서비스 중:
- **https://statscope-eta.vercel.app** (또는 US 도메인) → 영어
- **https://statscope.kr** → 한국어

모두 같은 코드베이스, 같은 Firebase 데이터베이스입니다! 🚀
