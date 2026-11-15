# 조각나침반 (Jogak Compass)

조각투자(투자계약증권) **증권신고서를 AI가 읽고**, 돈 버는 방식·묶이는 기간·돌려받는 방법·수수료·위험을
**같은 기준으로 비교해 쉬운 말로 설명**하는 서비스예요. (기획서: 조각투자 에이전트 1-pager, MVP 범위)

## 기능 (MVP)

| 기획서 기능 | 구현 |
|---|---|
| 상품 구조 한 장 요약 | DART 원문(document.xml)을 받아 섹션별로 파싱 → GPT가 구조화 출력(JSON schema)으로 정리. **모든 항목에 원문 인용 근거**를 붙이고, 서버가 인용문을 원문과 대조해 `✓ 원문 대조됨 / ! 원문 확인 필요`를 표시. 근거가 없으면 "문서에서 확인 불가" |
| 표준 비교표 | 상품 2~4개를 같은 항목으로 비교, 수수료를 **"N년 보유 시 총비용"**으로 환산(코드 계산) |
| 실수익 계산기 | 투자금·기간·낙관/기본/비관 시나리오 → 수수료·보수·성과보수·세금 차감 실수령액, 예금 비교(코드 계산) |
| 나와 맞는지 체크 | 돈이 필요한 시점·목적·중도 인출 가능성·손실 감수 여부와 상품 조건의 **일치 여부만** 표시(추천 없음) |
| 문서 기반 질문하기 | 질문과 관련된 원문 섹션을 골라 GPT가 근거와 함께 답변, 매수·매도 권유 금지 |
| 내 조각자산(베타) | 보유 상품 등록·금액 입력, 발행사의 최근 1년 DART 공시 모아 보기 |

설계 원칙: **LLM은 문서를 읽고 설명만**, 수수료 합계·수익 같은 숫자는 `lib/calc.ts`에서 코드로 계산해요.
API 키는 서버(API 라우트)에서만 쓰고 브라우저로 보내지 않아요.

## 구조

```
app/
  page.tsx               모바일 앱 화면(프로토타입 디자인)
  api/filings            투자계약증권 신고서 목록 / 회사명·DART 링크·접수번호 검색
  api/analyze            신고서 분석(30일 캐시, 공유 아카이브 등록, IP당 일일 제한)
  api/chat               문서 근거 챗봇(IP당 시간 제한)
  api/library            지금까지 분석된 상품
  api/disclosures        발행사 최근 공시
  api/health             설정 상태(키 값은 노출하지 않음)
lib/
  dart.ts                DART 오픈API(list, document, corpCode)
  docparse.ts            원문 zip → 섹션 텍스트, 인용 검증, 관련 섹션 선택
  extract.ts             GPT 추출 스키마·프롬프트·검증
  calc.ts / fit.ts       계산기·비교·조건 체크(순수 함수)
  store.ts               캐시·요청 제한(Upstash Redis 또는 메모리)
components/              화면 컴포넌트
tests/                   계산·파싱·API 흐름 테스트(외부 API는 가짜로 대체)
```

## 배포 (Vercel)

1. https://vercel.com/new 에서 이 GitHub 저장소를 **Import**
2. **Environment Variables**에 아래 값을 넣고 Deploy
   - `OPENAI_API_KEY` — OpenAI 키
   - `DART_API_KEY` — DART 오픈API 인증키
   - (선택) `OPENAI_MODEL` — 기본 `gpt-5.4-mini`
3. (권장) Vercel 프로젝트 → **Storage → Upstash Redis(Marketplace)** 연결
   → `KV_REST_API_URL`/`KV_REST_API_TOKEN`(또는 `UPSTASH_REDIS_REST_URL`/`TOKEN`)이 자동으로 들어가요.
   연결하면 분석 결과가 모든 사용자에게 공유되고(같은 신고서를 다시 분석하지 않아 비용 절감), 요청 제한이 정확해져요.
4. 배포 후 `https://<도메인>/api/health` 에서 `openai: true, dart: true` 확인

> DART 오픈API는 인증키에 등록된 IP 제한이 없으면 Vercel에서 바로 동작해요. 키 설정에서 IP 제한을 걸어 두었다면 해제해 주세요.

## 로컬 실행

```bash
cp .env.example .env.local   # 키 입력
npm install
npm run dev                  # http://localhost:3000
npm test                     # 계산·파싱·API 흐름 테스트
```

## 운영 시 참고

- **비용**: 신고서 1건 분석 = GPT 호출 1회(원문에서 관련 섹션 최대 약 9만 자). 결과는 30일 캐시돼요.
  `RATE_LIMIT_ANALYZE_PER_DAY`, `RATE_LIMIT_CHAT_PER_HOUR`로 IP당 사용량을 조절하세요.
- **정확도**: 인용 검증을 통과하지 못한 항목은 `원문 확인 필요`로 표시돼요. 기획서 목표(추출 정확도 95%)를 위해
  초기에는 사람이 검수하는 과정을 두는 걸 권해요.
- **규제**: 화면과 프롬프트 모두 매수·매도·보유를 권하지 않도록 설계했지만, 정식 출시 전 법률 검토(투자자문·중개 해당 여부)가 필요해요.
- **성공 지표**: `components/App.tsx`의 `onEvidence`가 "원문 근거 클릭" 지점이에요. 분석 도구를 붙여 이벤트를 보내면 신뢰 행동 지표를 잴 수 있어요.
- 가상 예시 상품 8개(`lib/samples.ts`)는 화면 시연용이며 화면에 "가상 예시"로 표시돼요.
