# SafeBeli SNS → 텔레그램 유입 자동화

목표: **인스타/스레드/유튜브 게시물 → 텔레그램 봇 유입 → SafeBeli 사용**
성과 지표는 좋아요가 아니라 `?start=` 링크로 들어온 사람 수다.

---

## 지금 되는 것 / 안 되는 것 (사실대로)

| 플랫폼 | 자동 발행 | 필요한 것 | 비고 |
|---|---|---|---|
| **텔레그램** | ✅ 완전 자동 | 봇 토큰 (5분) | 가장 쉽고 제한 거의 없음 |
| **스레드** | ✅ 완전 자동 | Meta 앱 + 장기 토큰 | 텍스트/이미지, 본문 500자 |
| **인스타그램** | ✅ 완전 자동 | 프로페셔널 계정 + Meta 앱 | **이미지 필수**, 24시간 25건 제한 |
| **유튜브** | ✅ 영상 업로드 자동 | Google Cloud OAuth | 커뮤니티 탭 글은 API 없음 → 수동 |
| 틱톡 | ⚠️ 앱 심사 통과 시 | Content Posting API | 심사 오래 걸림, 나중에 |
| X(트위터) | ⚠️ 무료 등급 제한 심함 | API v2 | 필요해지면 추가 |

**커넥터로는 안 됩니다.** Anthropic 커넥터 목록에 인스타/스레드/유튜브/텔레그램이 아직 없어서
"이미 로그인된 계정에 클로드가 바로 발송" 은 불가능합니다.
대신 위 공식 API 토큰을 **딱 한 번** 넣어두면 그다음부터는 동일하게 동작합니다.

---

## 역할 분담

### 대표님이 해야 하는 것 (최초 1회, 총 40~60분)
토큰 발급만 하시면 됩니다. 아래 A~D 참고. **한 번 하면 끝입니다.**

### 그 뒤로 제가 하는 것 (매번)
- 콘텐츠 축 선정, 플랫폼별 카피 작성, 해시태그, 발행 시각 배치
- 큐 등록 → 미리보기 → 승인 후 발행
- 유입 데이터(어느 글에서 몇 명 들어왔는지) 집계 및 다음 주 방향 제안

### 대표님이 매번 해야 하는 것
- **초안 승인 한 번** ("올려")
- 이미지/영상 소재 확보 (Canva 커넥터가 연결돼 있어 디자인 생성은 제가 도울 수 있습니다)

---

## A. 텔레그램 (5분) — 여기부터 하세요

1. 텔레그램에서 **@BotFather** → `/newbot` → 이름·유저네임 입력 → **토큰** 복사
2. 채널을 만들고, 만든 봇을 채널 **관리자**로 추가 (게시 권한 필요)
3. 채널이 공개면 `TELEGRAM_CHAT_ID` = `@채널유저네임`
   비공개면 `-100` 으로 시작하는 숫자 ID (@userinfobot 등으로 확인)

얻는 값: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_CHANNEL_URL`

### 유입 추적 웹훅 켜기 (이게 핵심)
Vercel 환경변수에 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`(아무 랜덤 문자열) 를 넣고 배포한 뒤:

```bash
curl -F "url=https://<도메인>/api/telegram-webhook" \
     -F "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
     "https://api.telegram.org/bot<TOKEN>/setWebhook"
```

Supabase에 테이블 하나 추가:

```sql
create table telegram_leads (
  id bigserial primary key,
  telegram_id text unique not null,
  username text,
  first_name text,
  source text,
  created_at timestamptz default now()
);
```

이제 인스타 글에서 들어온 사람은 `source = ig_<글id>` 로,
스레드에서 들어온 사람은 `th_<글id>` 로 자동 기록됩니다.
**어느 글이 진짜 고객을 데려왔는지가 숫자로 남습니다.**

---

## B. 스레드 (15분)

1. https://developers.facebook.com → 앱 만들기 → 용도 **"Threads API"**
2. 앱에 Threads 계정 연결, 권한 `threads_basic`, `threads_content_publish` 추가
3. 토큰 생성 후 **장기 토큰(60일)** 으로 교환:
   ```
   GET https://graph.threads.net/access_token
       ?grant_type=th_exchange_token
       &client_secret=<앱시크릿>
       &access_token=<단기토큰>
   ```
4. 사용자 ID 확인: `GET https://graph.threads.net/v1.0/me?fields=id,username&access_token=<토큰>`

얻는 값: `THREADS_USER_ID`, `THREADS_ACCESS_TOKEN`
⚠️ 60일마다 갱신 필요 — 만료 2주 전에 제가 알려드리도록 캘린더에 넣어둘 수 있습니다.

---

## C. 인스타그램 (20분)

1. 인스타 계정을 **프로페셔널(비즈니스/크리에이터)** 로 전환
2. 페이스북 페이지와 연결
3. Meta 앱에 `instagram_basic`, `instagram_content_publish`, `pages_show_list` 권한 추가
4. 장기 페이지 토큰 발급, IG 계정 ID 확인:
   ```
   GET https://graph.facebook.com/v21.0/me/accounts?access_token=<토큰>
   GET https://graph.facebook.com/v21.0/<page_id>?fields=instagram_business_account&access_token=<토큰>
   ```

얻는 값: `IG_USER_ID`, `IG_ACCESS_TOKEN`

**이미지 호스팅**: 인스타는 공개 URL 이미지만 받습니다.
`public/marketing/` 에 이미지를 넣고 커밋하면 `https://<도메인>/marketing/<파일명>` 으로 바로 쓸 수 있습니다.

---

## D. 유튜브 (20분, 영상 올릴 때만)

1. Google Cloud Console → 프로젝트 → **YouTube Data API v3** 사용 설정
2. OAuth 클라이언트(데스크톱 앱) 생성 → client id/secret
3. https://developers.google.com/oauthplayground 에서 우측 톱니 → "Use your own OAuth credentials" 체크 후 입력
4. 스코프 `https://www.googleapis.com/auth/youtube.upload` 승인 → **refresh token** 획득

얻는 값: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`

---

## 토큰 넣는 곳

**GitHub** → 저장소 → Settings → Secrets and variables → Actions

Secrets (비밀):
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `THREADS_USER_ID`, `THREADS_ACCESS_TOKEN`,
`IG_USER_ID`, `IG_ACCESS_TOKEN`, `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`

Variables (공개돼도 되는 값):
`MARKETING_SITE_URL`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_CHANNEL_URL`

로컬 테스트는 `cp marketing/.env.example marketing/.env` 후 채우세요. (`.gitignore` 처리됨)

---

## 사용법

```bash
# 지금 어떤 플랫폼이 준비됐는지 확인
node marketing/check.js

# 발행 예정 글 미리보기 (드라이런 — 아무것도 안 올라감)
node marketing/publish.js

# 특정 글 즉시 발행
node marketing/publish.js --id 2026-09-05-scam-checklist --now --live

# 텔레그램에만 발행
node marketing/publish.js --platform telegram --live
```

**자동 발행**: `.github/workflows/marketing-publish.yml` 이 매시 5분에 큐를 확인해서
`publishAt` 이 지난 글을 자동으로 올리고, 결과를 큐에 다시 기록합니다.
(GitHub Actions 의 schedule 은 기본 브랜치 기준으로 동작하므로, 이 브랜치를 main 에 머지해야 예약 발행이 시작됩니다.)

---

## 저에게 시키는 법

```
/sns-post 이번 주 인스타+스레드 3개 예약해줘. 주제는 쇼피 사기 판별 체크리스트
```

제가 하는 일: 콘텐츠 축 선택 → 플랫폼별 카피 → 큐 등록 → 미리보기 제시.
대표님은 보고 "올려" 한마디만 하시면 됩니다. **승인 없이는 절대 발행하지 않습니다.**

---

## 안전장치

- `--live` 없이 실행하면 **절대 발행되지 않습니다** (기본이 드라이런)
- 발행 성공한 플랫폼은 큐에 기록되어 **중복 발행되지 않습니다**
- 일부 플랫폼만 실패하면 `partial` 로 남아 다음 실행에서 실패분만 재시도합니다
- 토큰은 전부 환경변수에서만 읽습니다. 저장소에 커밋되지 않습니다.
