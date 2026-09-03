---
name: sns-post
description: SafeBeli 텔레그램 유입용 SNS 글을 작성해 발행 큐에 넣고, 예약 발행하거나 즉시 발행한다. 사용자가 "인스타 글 써줘", "스레드에 올려줘", "이번 주 SNS 예약해줘", "/sns-post" 라고 할 때 사용.
---

# SNS 발행 (텔레그램 유입용)

목표는 하나다: **SNS 게시물 → 텔레그램 봇 유입 → SafeBeli 사용**.
좋아요가 아니라 `?start=` 링크를 타고 들어온 사람 수가 성과다.

## 작업 순서

1. **큐 확인** — `marketing/content/queue.json` 을 읽어 최근 글의 톤/주제 중복을 피한다.
2. **초안 작성** — 아래 규칙대로 플랫폼별 본문을 쓰고 큐에 항목을 추가한다.
3. **미리보기** — `node marketing/publish.js --id <id> --now` (드라이런). 렌더된 본문을 사용자에게 보여준다.
4. **승인 받기** — 실제 발행은 외부 공개 행위다. 사용자가 명시적으로 "올려" 라고 하기 전에는 `--live` 를 절대 실행하지 않는다.
5. **발행**
   - 예약: 큐만 커밋·푸시 → 시각이 되면 GitHub Actions 가 자동 발행.
   - 즉시: `node marketing/publish.js --id <id> --now --live`

## 큐 항목 형식

```json
{
  "id": "2026-09-05-scam-checklist",
  "status": "scheduled",
  "publishAt": "2026-09-05T19:00:00+07:00",
  "platforms": ["telegram", "threads", "instagram"],
  "text": "기본 본문 ... {{link}}",
  "variants": { "instagram": "인스타 전용 본문 ... {{link}}" },
  "media": ["https://safebeli.vercel.app/marketing/2026-09-05.jpg"],
  "video": null,
  "title": null,
  "tags": []
}
```

- `id` 는 `YYYY-MM-DD-슬러그`. 영문 소문자·숫자·하이픈만.
- `publishAt` 은 **+07:00 (WIB, 인도네시아 시간)** 로 쓴다. 타깃 사용자가 인도네시아다.
- `{{link}}` 는 발행 시 플랫폼별 추적 링크로 자동 치환된다. **직접 링크를 하드코딩하지 말 것** — 유입 출처가 안 잡힌다.
- 인스타그램은 **이미지 없이는 발행 불가**. `media` 없이 instagram 을 넣지 않는다.
- 유튜브는 `video` (리포 기준 상대경로) 가 필요하다. 커뮤니티 탭 글은 API 가 없어 자동화 불가.

## 플랫폼별 카피 규칙

| | 언어 | 길이 | 링크 | 후크 |
|---|---|---|---|---|
| 텔레그램 | Bahasa Indonesia | 자유 | 본문에 직접 | 채널 구독자 대상 심화 정보 |
| 스레드 | Bahasa Indonesia | **500자 상한** | 본문 마지막 줄 | 첫 문장에서 승부. 질문형/대비형 |
| 인스타 | Bahasa Indonesia | 2200자 (앞 125자가 승부처) | 본문 + "link di bio" 병기 | 캐러셀 1장차 = 후크, 마지막 장 = CTA |
| 유튜브 | Bahasa Indonesia | 설명 5000자 | 설명 첫 줄 | Shorts 기준 첫 2초 후크 |

**공통**
- 판매 문구로 시작하지 않는다. 피해 사례·체크리스트·실제 링크 판별 결과로 시작한다.
- CTA 는 글마다 하나. "링크 붙여넣으면 AI가 3초 안에 판별해준다" 로 수렴시킨다.
- 해시태그는 인스타 5~10개, 스레드 0~2개. 인도네시아어 태그 위주 (#penipuanonline #belanjaaman #tipsbelanja).
- 이모지는 줄당 최대 1개.

## 콘텐츠 축 (소재 고갈 방지)

1. **실제 판별** — 실제 사기 의심 링크를 분석해 점수와 근거 공개
2. **체크리스트** — "이 5가지면 90% 걸러진다"
3. **피해 사례 해부** — 사례 → 어디서 신호가 있었나
4. **플랫폼별 함정** — Shopee / Tokopedia / WhatsApp 판매자 유형별
5. **사용자 후기** — 실제 유저 결과 캡처
6. **비하인드** — 만드는 과정, 숫자 공개

같은 축을 연속 2회 쓰지 않는다.

## 하지 말 것

- 승인 없이 `--live` 실행
- `marketing/.env` 나 토큰을 커밋
- 인스타 media 없이 발행 시도
- 큐의 `results` 필드를 손으로 수정 (발행기가 관리한다)
