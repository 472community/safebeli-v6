# 커뮤니티 텔레그램 유입 자동화

목표: **인스타/스레드/유튜브 게시물 → 텔레그램 유입 → 커뮤니티 정착**
성과 지표는 좋아요가 아니라 `?start=` 링크로 들어온 사람 수다.

> 이 폴더는 **독립 도구**다. 같은 저장소에 있는 다른 앱 코드와 아무 관계가 없고,
> 그 앱의 배포·환경변수·도메인에 의존하지 않는다. 필요하면 폴더째 다른 저장소로 옮겨도 그대로 돈다
> (옮길 것: `marketing/`, `.github/workflows/marketing-publish.yml`, `.claude/skills/sns-post/`).

---

## 지금 되는 것 / 안 되는 것 (사실대로)

| 플랫폼 | 자동 발행 | 필요한 것 | 비고 |
|---|---|---|---|
| **텔레그램** | ✅ 완전 자동 | 봇 토큰 (5분) | 가장 쉽고 제한 거의 없음 |
| **스레드** | ✅ 완전 자동 | Meta 앱 + 장기 토큰 | 텍스트/이미지, 본문 500자 |
| **인스타그램 (피드·캐러셀·릴스)** | ✅ 완전 자동 | 프로페셔널 계정 + Meta 앱 | **이미지/영상 필수**, 24시간 25건 제한 |
| **유튜브 (쇼츠 포함)** | ✅ 완전 자동 | Google Cloud OAuth | 세로 3분 이하면 자동으로 쇼츠 처리. 커뮤니티 탭 글은 API 없음 |
| **틱톡** | ⚠️ 업로드는 자동, 공개는 심사 후 | TikTok 개발자 앱 | **심사 전에는 비공개로만 게시됨** (아래 E 참고) |
| X(트위터) | ⚠️ 무료 등급 제한 심함 | API v2 | 필요해지면 추가 |

**커넥터로는 안 됩니다.** Anthropic 커넥터 목록에 인스타/스레드/유튜브/텔레그램이 아직 없어서
"이미 로그인된 계정에 클로드가 바로 발송" 은 불가능합니다.
대신 위 공식 API 토큰을 **딱 한 번** 넣어두면 그다음부터는 동일하게 동작합니다.

---

## 역할 분담

### 대표님이 해야 하는 것 (최초 1회)
토큰 발급뿐입니다 (A~E). 필요한 것만, 하나씩 하셔도 됩니다.
**스레드(B, 15분)부터 하시면 그날 바로 첫 글이 나갑니다.**

### 그 뒤로 제가 하는 것 (매번)
- 콘텐츠 축 선정, 플랫폼별 카피 작성, 해시태그, 발행 시각 배치
- 큐 등록 → 미리보기 → 승인 후 발행
- 유입 데이터(어느 글에서 몇 명 들어왔는지) 집계 → 다음 주 방향 제안

### 대표님이 매번 해야 하는 것
- **초안 승인 한 번** — `node marketing/go.js` 실행하고 `y`
- 이미지/영상 소재 확보 (Canva 커넥터가 연결돼 있어 디자인 생성은 제가 도울 수 있습니다)

---

## 0. brand.json — 이미 채워져 있습니다

커뮤니티 정체성, 타깃, 톤, 콘텐츠 축, 금지 표현, 채널 구분(텔레그램/SNS/포스타입),
텔레그램 채널 주소까지 `marketing/brand.json` 에 정리돼 있습니다.
Claude 는 글을 쓸 때마다 이 파일을 근거로 삼습니다.

아직 비어 있는 것:

- `revenue.referral.exchanges` — 제휴 거래소명과 레퍼럴 링크
- `revenue.membership.url` — 포스타입 주소

둘 다 거래소·구독 단계에 가서 필요합니다. 지금 단계(텔레그램 유입)에서는 없어도 됩니다.

---

## A. 텔레그램 유입 링크 (5분)

기본은 **채널 직결**입니다. 봇 없이 바로 됩니다.

`brand.json` 의 `telegram.channelUrl` 에 채널 주소가 들어 있으면 그걸로 나갑니다.

### 플랫폼별 유입 수를 보고 싶다면 (권장, 5분)

텔레그램 채널 → **관리 → 초대 링크 → 새 링크 만들기** 를 4번 반복해서
이름을 각각 `threads` / `instagram` / `tiktok` / `youtube` 로 붙이세요.
생성된 주소를 `brand.json` 의 `telegram.inviteLinks` 에 넣으면 끝입니다.

```json
"inviteLinks": {
  "threads":   "https://t.me/+xxxxx",
  "instagram": "https://t.me/+yyyyy",
  "tiktok":    "https://t.me/+zzzzz",
  "youtube":   "https://t.me/+wwwww"
}
```

이제 채널 관리 화면에서 **링크별 가입자 수**가 보입니다.
어느 플랫폼이 사람을 데려왔는지 알 수 있고, **마찰은 0** 입니다.

### 글 단위까지 보고 싶다면 (봇 필요)

어느 *영상*이 데려왔는지까지 알고 싶으면 봇이 필요합니다.

1. 텔레그램에서 **@BotFather** → `/newbot` → 이름·유저네임 입력 (유저네임은 `bot` 으로 끝나야 함)
2. 받은 토큰과 유저네임을 `.env` 또는 repo secrets 에 넣기
3. `TELEGRAM_LINK_MODE=bot` 으로 전환

그러면 링크가 `https://t.me/<봇>?start=tt_2026-09-13-...` 형태가 되고,
`node marketing/collect-leads.js` 가 누가 어느 글을 보고 들어왔는지 기록합니다.
대신 사용자가 봇 화면을 한 번 거칩니다.

| 방식 | 마찰 | 측정 단위 | 봇 |
|---|---|---|---|
| 채널 직결 + 초대링크 | 없음 | 플랫폼 단위 | 불필요 |
| 봇 경유 | 한 단계 | **글 단위** | 필요 |

### 봇이 반드시 필요해지는 때

- 텔레그램 채널에 **자동으로 글을 올릴 때** (채널 게시는 봇만 가능)
- 신규 유입에게 **환영 메시지를 자동 발송**할 때
- 글 단위 유입 추적

지금은 셋 다 필요 없으므로 봇 없이 진행합니다.
나중에 텔레그램 운영을 시작하실 때 만드시면 됩니다 — 그때는 채널 관리자로 추가하고
"메시지 게시" 권한을 켜야 합니다.

---

## B. 스레드 (15분) — 여기부터 하세요

가장 빨리 되는 플랫폼입니다. 영상 없이 글만으로도 바로 돌릴 수 있습니다.

### 1) Meta 앱 만들기

1. https://developers.facebook.com/apps → **앱 만들기**
2. 사용 사례에서 **Threads API** 를 선택 (목록에 없으면 "기타" → "비즈니스" 후 제품에서 Threads API 추가)
3. 앱이 만들어지면 **Threads API** 제품으로 들어갑니다

### 2) 권한과 테스터 설정

- 권한(스코프)에 **`threads_basic`**, **`threads_content_publish`** 두 개를 추가합니다
- **앱 역할 → 역할** 에서 본인 스레드 계정을 **Threads 테스터**로 추가합니다
- 스레드 앱(모바일) → 설정 → 웹사이트 권한 → **테스터 초대 수락**

> 이 수락을 안 하면 토큰이 나와도 게시가 계속 실패합니다. 제일 흔한 막힘 지점입니다.

### 3) 토큰 받기

Threads API 대시보드에서 **사용자 토큰 생성(Generate access token)** 을 누르면
**1시간짜리 단기 토큰**이 나옵니다. 이걸 60일짜리로 바꿔야 합니다.

`marketing/.env` 에 앱 시크릿부터 넣고:

```
THREADS_APP_SECRET=<Meta 앱 > 설정 > 기본 > 앱 시크릿 코드>
```

그다음 한 줄이면 끝납니다:

```bash
node marketing/threads-token.js --exchange <단기토큰>
```

계정 확인, 장기 토큰 교환, 사용자 ID 조회를 한 번에 처리하고
`.env` 에 붙여넣을 두 줄을 그대로 출력해줍니다.

### 4) 확인

```bash
node marketing/check.js
```

`● threads  연결됨 — @계정명` 이 나오면 끝입니다.

### 60일마다 갱신

스레드 장기 토큰은 60일 만료입니다. 만료 전에:

```bash
node marketing/threads-token.js --refresh
```

새 토큰을 출력해줍니다. `.env` 와 GitHub repo secrets 양쪽을 바꿔주세요.
(만료되면 다시 단기 토큰부터 받아야 하니 미리 캘린더에 넣어두는 편이 낫습니다.)

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

**릴스**: 큐에 `videoUrl` 이 있으면 자동으로 릴스로 올라갑니다 (`share_to_feed` 켜져 있어 피드에도 노출).
`media` 의 첫 이미지는 커버로 쓰입니다.

**미디어 호스팅**: 인스타는 공개 URL 만 받습니다 (파일 업로드 불가).
어디든 공개 접근되는 곳(오브젝트 스토리지, 정적 호스팅, GitHub Raw 등)에 올리고
그 베이스 주소를 `MARKETING_MEDIA_BASE_URL` 에 넣으세요.
그러면 큐에는 `videos/파일명.mp4` 같은 상대경로만 적으면 됩니다.

---

## D. 유튜브 (20분, 영상 올릴 때만)

1. Google Cloud Console → 프로젝트 → **YouTube Data API v3** 사용 설정
2. OAuth 클라이언트(데스크톱 앱) 생성 → client id/secret
3. https://developers.google.com/oauthplayground 우측 톱니 → "Use your own OAuth credentials" 체크 후 입력
4. 스코프 `https://www.googleapis.com/auth/youtube.upload` 승인 → **refresh token** 획득

얻는 값: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`

세로 3분 이하 영상은 유튜브가 알아서 **쇼츠**로 처리합니다. 설명란에 `#Shorts` 도 자동으로 붙습니다.

---

## E. 틱톡 (25분 + 심사 대기)

1. https://developers.tiktok.com → 앱 생성
2. **Content Posting API** 추가, 스코프 `video.publish` + `user.info.basic`
3. Login Kit 으로 OAuth 인증 → **refresh token** 획득 (유효기간 1년)

얻는 값: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN`

### ⚠️ 틱톡만 다른 점 — 반드시 읽으세요

틱톡은 **앱 심사(Audit)를 통과하기 전까지 공개 게시가 안 됩니다.**
심사 전에는 업로드는 되지만 전부 **비공개(SELF_ONLY)** 로 올라가고,
틱톡 앱에서 직접 공개로 전환해야 합니다.

그래서 실제 운영은 이렇게 됩니다:

| 시점 | 자동화 범위 | 대표님이 할 일 |
|---|---|---|
| 심사 전 | 업로드까지 자동 | 틱톡 앱에서 공개 전환 (1분) |
| 심사 후 | 공개 게시까지 전자동 | 없음 |

심사 통과 후 `TIKTOK_PRIVACY_LEVEL=PUBLIC_TO_EVERYONE` 을 Variables 에 넣으면 전자동이 됩니다.
발행기는 게시 전에 틱톡에 허용 범위를 물어보고, 허용되지 않은 값은 쓰지 않습니다
(잘못된 값을 보내면 거부되기 때문입니다).

---

## 토큰 넣는 곳

**GitHub** → 저장소 → Settings → Secrets and variables → Actions

Secrets (비밀):
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `THREADS_USER_ID`, `THREADS_ACCESS_TOKEN`,
`THREADS_APP_SECRET`, `IG_USER_ID`, `IG_ACCESS_TOKEN`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN`,
`YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`

Variables (공개돼도 되는 값):
`MARKETING_MEDIA_BASE_URL`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_CHANNEL_URL`,
`TELEGRAM_WELCOME_MESSAGE`, `TIKTOK_PRIVACY_LEVEL`

---

## 영상 하나로 3곳 (틱톡 · 릴스 · 쇼츠)

큐에 `videoUrl` 하나만 적으면 세 플랫폼이 알아서 나눠 가집니다.

```json
{
  "platforms": ["tiktok", "instagram", "youtube"],
  "videoUrl": "videos/2026-09-12-leverage-time.mp4",
  "text": "공통 캡션 ... {{link}}",
  "variants": { "youtube": "유튜브용 긴 설명 ... {{link}}" }
}
```

- **인스타 릴스**는 공개 URL 을 그대로 넘깁니다
- **틱톡 · 유튜브**는 파일 바이트를 올려야 해서, 발행기가 그 URL 에서 **자동으로 받아** 업로드합니다
- 그래서 대표님은 영상을 **한 군데만** 올리면 됩니다

**권장 규격**: 세로 9:16, 1080×1920, 30~60초, mp4(H.264/AAC)
세 플랫폼 모두 이 규격이면 그대로 통과합니다.

**추적**: 같은 영상이라도 플랫폼마다 다른 링크가 붙습니다 —
`tt_...`(틱톡) / `ig_...`(릴스) / `yt_...`(쇼츠).
어느 플랫폼이 사람을 데려왔는지 따로 잡힙니다.

---

## 거래소 레퍼럴 링크

`brand.json` 의 `revenue.referral.exchanges` 에 등록합니다.

```json
"exchanges": [
  { "name": "바이낸스", "url": "https://..." },
  { "name": "비트겟",  "url": "https://..." }
]
```

본문에서는 `{{ref}}`(대표 거래소) 또는 `{{ref:비트겟}}`(지정) 으로 씁니다.

**중요 — 발행기가 막습니다:**
`{{ref}}` 는 **텔레그램과 유튜브 설명란에서만** 허용됩니다.
스레드·인스타·틱톡 본문에 넣으면 발행이 거부됩니다.
이 세 곳은 제휴 링크를 스팸으로 판정해서 도달을 죽이거나 계정을 제재하기 때문입니다.
**우회가 아니라 정석입니다.** SNS 의 CTA 는 텔레그램 하나뿐입니다.

(유튜브 설명란에 제휴 링크를 넣을 때는 유료 프로모션 표시를 함께 해주세요.)

로컬 테스트는 `cp marketing/.env.example marketing/.env` 후 채우세요. (`.gitignore` 처리됨)

---

## 한 번에 올리기 (평소 쓰실 명령은 이거 하나입니다)

```bash
node marketing/go.js
```

1. 발행 대기 중인 초안을 전부 보여주고
2. 플랫폼별로 실제 올라갈 문구를 그대로 미리보기하고
3. `y` 한 번 누르면 **스레드·인스타 릴스·틱톡·유튜브 쇼츠에 동시에** 올라갑니다

연결 안 된 계정은 알아서 건너뛰고, 나머지만 올립니다.
실패한 플랫폼이 있으면 다시 실행할 때 **실패분만** 재시도합니다 (중복 게시 없음).

```bash
node marketing/go.js <글id>    # 그 글 하나만
node marketing/go.js --yes     # 확인 없이 바로
```

---

## 영상 유형은 두 가지 (`templates.json`)

| 유형 | 목적 | 구조 | CTA |
|---|---|---|---|
| **inflow** (유입) | 텔레그램 입장 | 판 비판 → 우리가 당해왔다 → 나도 깡통 찼다 → 안 당하는 법 공부 중 → 보고 도움 되면 좋겠다 → 텔레그램 | 텔레그램 하나 |
| **education** (교육) | 실력 증명 | 통념 → 반박 → 증명 → 한 줄 정리 | 약하게 / 없어도 됨 |

유입 영상은 **후킹의 비판 각도를 매번 바꿔야** 합니다. 같은 비판을 반복하면 두 번째부터 안 먹힙니다.
그리고 유입 영상에는 **거래소 레퍼럴을 절대 넣지 않습니다.** 신뢰를 쌓는 자리에서 팔면 둘 다 잃습니다.

---

## 그 외 명령

```bash
node marketing/check.js                      # 어느 플랫폼이 준비됐는지
node marketing/publish.js                    # 발행 예정 글 미리보기 (아무것도 안 올라감)
node marketing/publish.js --id <id> --now --live   # 특정 글 즉시 발행
node marketing/publish.js --platform telegram --live
node marketing/collect-leads.js              # 유입 수집 + 집계
```

**자동 실행**: `.github/workflows/marketing-publish.yml` 이 매시 5분에
① 발행 시각이 지난 글을 올리고 ② 신규 유입을 수집해 저장소에 기록합니다.
(GitHub Actions 의 schedule 은 기본 브랜치 기준이므로, 이 브랜치를 머지해야 시작됩니다.)

---

## 저에게 시키는 법

```
/sns-post 이번 주 인스타+스레드 3개 예약해줘
```

제가 하는 일: 유입 데이터 확인 → 콘텐츠 축 선택 → 플랫폼별 카피 → 큐 등록 → 미리보기.
대표님은 보고 "올려" 한마디만 하시면 됩니다. **승인 없이는 절대 발행하지 않습니다.**

---

## 안전장치

- `--live` 없이 실행하면 **절대 발행되지 않습니다** (기본이 드라이런)
- 초안은 `status: "draft"` 라 **승인 전에는 자동 발행되지 않습니다** (`scheduled` 로 바꿔야 나갑니다)
- 발행 성공한 플랫폼은 큐에 기록되어 **중복 발행되지 않습니다**
- 일부 플랫폼만 실패하면 `partial` 로 남아 다음 실행에서 실패분만 재시도합니다
- 재유입한 사람은 **최초 유입 출처를 유지**합니다 (성과 이중계상 방지)
- 토큰은 전부 환경변수에서만 읽습니다. 저장소에 커밋되지 않습니다.
